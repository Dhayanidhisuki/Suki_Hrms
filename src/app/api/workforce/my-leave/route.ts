/**
 * GET  /api/workforce/my-leave?year=
 *   The logged-in employee's own leave balances for the year, plus their
 *   full application history. Self-service: employeeId is resolved from
 *   the session, never taken from a query param.
 * POST /api/workforce/my-leave
 *   Apply for leave on one of the employee's own leave types. New
 *   applications start at 'pending_manager' (two-stage approval:
 *   Manager → HR — same engine as /api/workforce/leave/applications,
 *   just self-scoped instead of RBAC-gated) — except when the applicant is
 *   themselves a reporting manager, who has no one at Stage 1 to act on
 *   their request, so it starts at 'pending_hr' instead. Checks LeaveBalance if one
 *   exists; if none exists yet the application is allowed through, same
 *   as the HR-side route (Phase 1 has no automated accrual job for every
 *   employee/type/year combination).
 *   Comp-Off (leaveMaster.code === 'COMPOFF') is the one leave type that
 *   never gets a LeaveBalance row — it is spent against CompOffBalance
 *   instead, so it gets its own check here rather than falling through
 *   the (always-empty, therefore always-allowed) LeaveBalance lookup below.
 *   Mirrors the same check finalizeApproval.ts's checkSufficientBalance()
 *   applies at approval time, so an over-budget request is refused up
 *   front instead of only being discovered when a manager/HR looks at it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { myLeaveApplicationSchema } from '@/lib/validations/workforce';
import { validateLeaveSubmission, planSummary } from '@/lib/leave/submission';
import { getCompOffBalance } from '@/lib/compOffTransactions';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';
import { checkRangeNotFrozen } from '@/lib/attendanceFreeze';

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

  const [balances, prevBalances, applications, compOff, employee] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { employeeId: ownEmployeeId, year, leaveMaster: { isActive: true, deletedAt: null } },
      include: { leaveMaster: { select: { id: true, code: true, name: true } } },
      orderBy: { leaveMaster: { name: 'asc' } },
    }),
    // Only what's needed for the "vs last year" comparison — a second
    // full include would be wasted since these rows are never rendered.
    prisma.leaveBalance.findMany({
      where: { employeeId: ownEmployeeId, year: year - 1, leaveMaster: { isActive: true, deletedAt: null } },
      select: { leaveMasterId: true, closingBalance: true },
    }),
    prisma.leaveApplication.findMany({
      where: { employeeId: ownEmployeeId, fromDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
      include: { leaveMaster: { select: { id: true, code: true, name: true } } },
      orderBy: { appliedAt: 'desc' },
    }),
    getCompOffBalance(ownEmployeeId),
    prisma.employee.findUnique({
      where: { id: ownEmployeeId },
      select: { reportingManager: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const prevByType = new Map(prevBalances.map((b) => [b.leaveMasterId, Number(b.closingBalance)]));
  const balancesWithTrend = balances.map((b) => ({
    ...b,
    // null when there's no prior-year row to compare against — never a
    // fabricated 0%. Also null when last year's balance was 0 (an "up from
    // nothing" percentage is not a meaningful figure).
    previousClosingBalance: prevByType.get(b.leaveMasterId) ?? null,
  }));

  const reportingManagerName = employee?.reportingManager
    ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName ?? ''}`.trim()
    : null;

  return NextResponse.json({
    balances: balancesWithTrend,
    applications,
    compOffBalance: {
      available: Number(compOff.balance),
      earned: Number(compOff.earned),
      used: Number(compOff.used),
      expired: Number(compOff.expired),
    },
    reportingManagerName,
  });
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
  const { leaveMasterId, fromDate, toDate, isHalfDay, reason } = parsed.data;

  const freezeErr = await checkRangeNotFrozen(ownEmployeeId, fromDate, isHalfDay ? fromDate : toDate);
  if (freezeErr) return freezeErr;

  const companyId = (await prisma.employee.findUnique({ where: { id: ownEmployeeId }, select: { companyId: true } }))?.companyId;
  if (!companyId) return NextResponse.json({ error: 'Employee has no company' }, { status: 400 });

  const checked = await validateLeaveSubmission({ companyId, employeeId: ownEmployeeId, leaveMasterId, fromDate, toDate, isHalfDay });
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: checked.status });

  // A reporting manager applying for their own leave has no one at Stage 1
  // to act on it — isManagerOfAnyLevel would reject every caller, per
  // /api/workforce/leave/applications/[id]/approve. Skip straight to HR for
  // applicants who are themselves a reporting manager (same "isManager"
  // check as /api/auth/me), regardless of their own reportingManagerId.
  const isManagerApplicant =
    (await prisma.employee.count({
      where: { reportingManagerId: ownEmployeeId, deletedAt: null, isActive: true },
    })) > 0;

  const record = await prisma.leaveApplication.create({
    data: {
      employeeId: ownEmployeeId,
      leaveMasterId,
      companyId,
      fromDate: checked.fromDate,
      toDate: checked.toDate,
      numberOfDays: checked.plan.count,
      calendarDays: checked.plan.calendarDays,
      nonWorkingDaysCounted: checked.plan.nonWorkingCounted,
      isHalfDay,
      reason: reason ?? null,
      status: isManagerApplicant ? 'pending_hr' : 'pending_manager',
    },
    include: { leaveMaster: { select: { code: true, name: true } } },
  });

  await notifyEssRequest({
    companyId,
    kind: 'LEAVE',
    action: 'SUBMITTED',
    employeeId: ownEmployeeId,
    requestId: record.id,
    period: formatPeriod(record.fromDate, record.toDate),
    reason: reason ?? undefined,
    linkPath: '/approvals/workforce/leave',
  });

  return NextResponse.json({ ...record, plan: planSummary(checked.plan) }, { status: 201 });
}
