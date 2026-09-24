/**
 * GET  /api/workforce/my-leave?year=
 *   The logged-in employee's own leave balances for the year, plus their
 *   full application history. Self-service: employeeId is resolved from
 *   the session, never taken from a query param.
 * POST /api/workforce/my-leave
 *   Apply for leave on one of the employee's own leave types. New
 *   applications start at 'pending_manager' (two-stage approval:
 *   Manager → HR — same engine as /api/workforce/leave/applications,
 *   just self-scoped instead of RBAC-gated). Checks LeaveBalance if one
 *   exists; if none exists yet the application is allowed through, same
 *   as the HR-side route (Phase 1 has no automated accrual job for every
 *   employee/type/year combination).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { myLeaveApplicationSchema } from '@/lib/validations/workforce';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const year = Number(request.nextUrl.searchParams.get('year')) || new Date().getUTCFullYear();

  const [balances, applications] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { employeeId: ownEmployeeId, year, leaveMaster: { deletedAt: null } },
      include: { leaveMaster: { select: { id: true, code: true, name: true } } },
      orderBy: { leaveMaster: { name: 'asc' } },
    }),
    prisma.leaveApplication.findMany({
      where: { employeeId: ownEmployeeId, fromDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
      include: { leaveMaster: { select: { id: true, code: true, name: true } } },
      orderBy: { appliedAt: 'desc' },
    }),
  ]);

  return NextResponse.json({ balances, applications });
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

  const parsed = myLeaveApplicationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { leaveMasterId, fromDate, toDate, numberOfDays, isHalfDay, reason } = parsed.data;

  if (toDate < fromDate) {
    return NextResponse.json({ error: 'toDate cannot be before fromDate' }, { status: 400 });
  }

  const leaveMaster = await prisma.leaveMaster.findFirst({
    where: { id: leaveMasterId, isActive: true, deletedAt: null },
  });
  if (!leaveMaster) {
    return NextResponse.json({ error: 'Invalid or inactive leave type' }, { status: 400 });
  }

  const year = fromDate.getUTCFullYear();
  const balance = await prisma.leaveBalance.findUnique({
    where: { employeeId_leaveMasterId_year: { employeeId: ownEmployeeId, leaveMasterId, year } },
  });
  if (balance && Number(balance.closingBalance) < numberOfDays) {
    return NextResponse.json(
      { error: `Insufficient leave balance: ${balance.closingBalance} available, ${numberOfDays} requested` },
      { status: 400 }
    );
  }

  const record = await prisma.leaveApplication.create({
    data: { employeeId: ownEmployeeId, leaveMasterId, fromDate, toDate, numberOfDays, isHalfDay, reason: reason ?? null, status: 'pending_manager' },
    include: { leaveMaster: { select: { code: true, name: true } } },
  });

  return NextResponse.json(record, { status: 201 });
}
