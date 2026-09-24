/**
 * GET  /api/workforce/ot-request?scope=mine|manager|hr|actioned
 *      — mine: the logged-in employee's own requests, any status.
 *      — manager: requests awaiting the logged-in employee's own approval
 *        as Reporting Manager (status=pending_manager, employee.reportingManagerId
 *        = caller). Hierarchy-gated, not RBAC-permission-gated — see
 *        src/lib/reportingManager.ts.
 *      — hr: requests awaiting final HR approval (status=pending_hr),
 *        gated by the workforce.ot.view permission — same grant the
 *        biometric-flagged OT queue already uses, since both end up
 *        crediting the same DailyAttendance OT fields.
 *      — actioned: what this caller has personally decided, at either stage.
 * POST /api/workforce/ot-request
 *      — the logged-in employee asks to be credited overtime for one of
 *        their own days. Self-service: employeeId is resolved from the
 *        session, never taken from the request body. Starts at
 *        status=pending_manager. Distinct from the biometric-flagged OT
 *        queue (/api/workforce/attendance/ot) — this is for OT the
 *        employee is claiming themselves, not what punches already show.
 *        DailyAttendance is untouched until HR gives final approval.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { otRequestSchema } from '@/lib/validations/workforce';
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
    const data = await prisma.oTRequest.findMany({
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
    const data = await prisma.oTRequest.findMany({
      where: { status: 'pending_manager', employee: { reportingManagerId: ownEmployeeId, companyId: scope.companyId } },
      include,
      orderBy: { appliedAt: 'asc' },
    });
    return NextResponse.json({ data });
  }

  if (scopeParam === 'hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.ot.view');
    if (permErr) return permErr;
    const data = await prisma.oTRequest.findMany({
      where: { status: 'pending_hr', employee: { companyId: scope.companyId } },
      include,
      orderBy: { appliedAt: 'asc' },
    });
    return NextResponse.json({ data });
  }

  if (scopeParam === 'actioned') {
    const data = await prisma.oTRequest.findMany({
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

  const parsed = otRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // One open OT request per day — same guard Mis-Punch uses. Without it an
  // employee could stack several claims for the same date and whichever the
  // approver actioned last would silently be the one that landed.
  const existing = await prisma.oTRequest.findFirst({
    where: {
      employeeId: ownEmployeeId,
      date: parsed.data.date,
      status: { in: ['pending_manager', 'pending_hr'] },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `You already have an OT request for this date awaiting approval (#${existing.id}). Cancel or wait for it to be actioned before raising another.` },
      { status: 409 }
    );
  }

  const record = await prisma.oTRequest.create({
    data: {
      employeeId: ownEmployeeId,
      date: parsed.data.date,
      requestedMinutes: parsed.data.requestedMinutes,
      reason: parsed.data.reason,
    },
  });

  await notifyEssRequest({
    kind: 'OT',
    action: 'SUBMITTED',
    employeeId: record.employeeId,
    requestId: record.id,
    period: formatPeriod(record.date),
    reason: record.reason,
    linkPath: '/ess/ot-request',
  });

  return NextResponse.json(record, { status: 201 });
}
