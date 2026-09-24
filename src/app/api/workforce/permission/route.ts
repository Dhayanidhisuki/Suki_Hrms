/**
 * GET  /api/workforce/permission?scope=mine|manager|hr
 *      — mine: the logged-in employee's own requests, any status.
 *      — manager: pending_manager requests for this manager's reports
 *        (hierarchy-gated, no RBAC permission needed).
 *      — hr: all pending_hr requests for the company (RBAC-gated on
 *        workforce.permission.view).
 * POST /api/workforce/permission
 *      — the logged-in employee applies for permission (short leave in
 *        hours) on one of their own days. Self-service: employeeId is
 *        resolved from the session, never taken from the request body.
 *        New requests start at status 'pending_manager' (two-stage
 *        approval: Manager → HR). A request that would take the month
 *        past PermissionPolicy.freeHoursPerMonth is refused outright —
 *        the slab is a hard cap, not a threshold that converts to LOP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { permissionRequestSchema } from '@/lib/validations/workforce';
import { getFreeHoursPerMonth, getFreeHoursPerMonthForEmployee } from '@/lib/permissionPolicy';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const scopeParam = request.nextUrl.searchParams.get('scope') ?? 'mine';
  const include = { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } };

  if (scopeParam === 'mine') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId) {
      return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
    }
    const data = await prisma.permissionRequest.findMany({ where: { employeeId: ownEmployeeId }, include, orderBy: { appliedAt: 'desc' } });

    // The monthly pool is consumed in whatever splits the employee chooses —
    // 30 minutes one day, an hour the next — so what they need before asking
    // is how much is left, not just a list of past requests. Pending hours
    // count against it: two requests that each fit the balance can still
    // exceed it together, and that should be visible before the second is
    // raised rather than discovered at HR approval.
    const freeHoursPerMonth = await getFreeHoursPerMonth(scope.companyId);

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const thisMonth = data.filter(
      (r) => r.date >= monthStart && r.date < monthEnd && ['pending_manager', 'pending_hr', 'approved'].includes(r.status)
    );
    const approvedHours = thisMonth.filter((r) => r.status === 'approved').reduce((sum, r) => sum + Number(r.hours), 0);
    const pendingHours = thisMonth.filter((r) => r.status !== 'approved').reduce((sum, r) => sum + Number(r.hours), 0);
    const usedHours = approvedHours + pendingHours;

    return NextResponse.json({
      data,
      allowance: {
        freeHoursPerMonth,
        approvedHours: Number(approvedHours.toFixed(2)),
        pendingHours: Number(pendingHours.toFixed(2)),
        usedHours: Number(usedHours.toFixed(2)),
        remainingHours: Number(Math.max(0, freeHoursPerMonth - usedHours).toFixed(2)),
        month: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
      },
    });
  }

  if (scopeParam === 'manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId) {
      return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
    }
    const data = await prisma.permissionRequest.findMany({
      where: { status: 'pending_manager', employee: { reportingManagerId: ownEmployeeId, companyId: scope.companyId, deletedAt: null } },
      include,
      orderBy: { appliedAt: 'asc' },
    });
    return NextResponse.json({ data });
  }

  if (scopeParam === 'hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.permission.view');
    if (permErr) return permErr;
    const data = await prisma.permissionRequest.findMany({
      where: { status: 'pending_hr', employee: { companyId: scope.companyId } },
      include,
      orderBy: { appliedAt: 'asc' },
    });
    return NextResponse.json({ data });
  }

  // What this caller has already acted on, at either stage. Needs no grant:
  // it is filtered to their own recorded action, so it can only ever return
  // requests they personally decided. Without this an approval vanishes the
  // moment it is actioned, leaving the approver no record of what they did.
  if (scopeParam === 'actioned') {
    const data = await prisma.permissionRequest.findMany({
      where: {
        employee: { companyId: scope.companyId },
        OR: [{ managerActionByUserId: userId }, { approvedByUserId: userId }],
      },
      include,
      orderBy: [{ approvedAt: 'desc' }, { managerActionAt: 'desc' }],
      take: 50,
    });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: 'scope must be one of: mine, manager, hr, actioned' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const parsed = permissionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const hours = Math.round(((parsed.data.toTime.getTime() - parsed.data.fromTime.getTime()) / 3600000) * 100) / 100;

  // Hard cap at the company's monthly slab: a request that would take the
  // month past the allowance is refused here rather than filed and later
  // turned into LOP. Anything not yet rejected counts against the balance —
  // two requests that each fit on their own must not be allowed to exceed
  // it together, and a request still awaiting approval has already claimed
  // those hours.
  const monthStart = new Date(Date.UTC(parsed.data.date.getUTCFullYear(), parsed.data.date.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(parsed.data.date.getUTCFullYear(), parsed.data.date.getUTCMonth() + 1, 1));
  const [freeHoursPerMonth, claimed] = await Promise.all([
    getFreeHoursPerMonthForEmployee(ownEmployeeId),
    prisma.permissionRequest.findMany({
      where: {
        employeeId: ownEmployeeId,
        date: { gte: monthStart, lt: monthEnd },
        status: { in: ['pending_manager', 'pending_hr', 'approved'] },
      },
      select: { hours: true },
    }),
  ]);
  const usedHours = claimed.reduce((sum, r) => sum + Number(r.hours), 0);
  const remainingHours = Math.round(Math.max(0, freeHoursPerMonth - usedHours) * 100) / 100;
  if (hours > remainingHours) {
    return NextResponse.json(
      {
        error:
          remainingHours === 0
            ? `Monthly permission allowance of ${freeHoursPerMonth} h is already used up for ${monthStart.toISOString().slice(0, 7)} — this request cannot be applied.`
            : `Only ${remainingHours} h of the ${freeHoursPerMonth} h monthly permission allowance is left — this request of ${hours} h cannot be applied.`,
        freeHoursPerMonth,
        usedHours: Math.round(usedHours * 100) / 100,
        remainingHours,
        requestedHours: hours,
      },
      { status: 400 }
    );
  }

  const record = await prisma.permissionRequest.create({
    data: {
      employeeId: ownEmployeeId,
      date: parsed.data.date,
      fromTime: parsed.data.fromTime,
      toTime: parsed.data.toTime,
      hours,
      reason: parsed.data.reason ?? null,
    },
  });

  await notifyEssRequest({
    kind: 'PERMISSION',
    action: 'SUBMITTED',
    employeeId: record.employeeId,
    requestId: record.id,
    period: formatPeriod(record.date),
    reason: record.reason ?? undefined,
    linkPath: '/ess/permission',
  });

  return NextResponse.json(record, { status: 201 });
}
