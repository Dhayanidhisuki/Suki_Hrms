/**
 * GET  /api/workforce/mispunch?scope=mine|manager|hr
 *      — mine: the logged-in employee's own requests, any status.
 *      — manager: requests awaiting the logged-in employee's own approval
 *        as Reporting Manager (status=pending_manager, employee.reportingManagerId
 *        = caller). Hierarchy-gated, not RBAC-permission-gated — see
 *        src/lib/reportingManager.ts.
 *      — hr: requests awaiting final HR approval (status=pending_hr),
 *        gated by the workforce.mispunch.view permission.
 * POST /api/workforce/mispunch
 *      — the logged-in employee applies for a correction to one of their
 *        own days. Self-service: employeeId is resolved from the session,
 *        never taken from the request body. Starts at status=pending_manager.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { mispunchRequestSchema } from '@/lib/validations/workforce';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const scopeParam = request.nextUrl.searchParams.get('scope') ?? 'mine';
  const include = {
    employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, reportingManagerId: true } },
  };

  if (scopeParam === 'mine') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId) {
      return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
    }
    const data = await prisma.mispunchCorrection.findMany({
      where: { employeeId: ownEmployeeId },
      include,
      orderBy: { appliedAt: 'desc' },
    });
    return NextResponse.json({ data });
  }

  if (scopeParam === 'manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId) {
      return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
    }
    const data = await prisma.mispunchCorrection.findMany({
      where: { status: 'pending_manager', employee: { reportingManagerId: ownEmployeeId, companyId: scope.companyId } },
      include,
      orderBy: { appliedAt: 'asc' },
    });
    return NextResponse.json({ data });
  }

  if (scopeParam === 'hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.mispunch.view');
    if (permErr) return permErr;
    const data = await prisma.mispunchCorrection.findMany({
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
    const data = await prisma.mispunchCorrection.findMany({
      where: {
        employee: { companyId: scope.companyId },
        OR: [{ managerActionByUserId: userId }, { hrActionByUserId: userId }],
      },
      include,
      orderBy: [{ hrActionAt: 'desc' }, { managerActionAt: 'desc' }],
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

  const parsed = mispunchRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // One open correction per day. Without this an employee could stack several
  // requests for the same date, and whichever the approver actioned last would
  // silently overwrite the attendance the earlier ones had already written.
  const existing = await prisma.mispunchCorrection.findFirst({
    where: {
      employeeId: ownEmployeeId,
      date: parsed.data.date,
      status: { in: ['pending_manager', 'pending_hr'] },
    },
    select: { id: true, status: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `You already have a correction request for this date awaiting approval (#${existing.id}). Cancel or wait for it to be actioned before raising another.` },
      { status: 409 }
    );
  }

  const record = await prisma.mispunchCorrection.create({
    data: {
      employeeId: ownEmployeeId,
      date: parsed.data.date,
      requestedInTime: parsed.data.requestedInTime ?? null,
      requestedOutTime: parsed.data.requestedOutTime ?? null,
      reason: parsed.data.reason,
    },
  });

  await notifyEssRequest({
    kind: 'MISPUNCH',
    action: 'SUBMITTED',
    employeeId: record.employeeId,
    requestId: record.id,
    period: formatPeriod(record.date),
    reason: record.reason,
    linkPath: '/ess/mispunch',
  });

  return NextResponse.json(record, { status: 201 });
}
