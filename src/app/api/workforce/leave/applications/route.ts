/**
 * GET  /api/workforce/leave/applications?status=&employeeId=
 * POST /api/workforce/leave/applications
 *
 * Apply for leave. Checks LeaveBalance if one exists for the employee/leave
 * type/year (numberOfDays must not exceed closingBalance); if no balance row
 * exists yet, the application is allowed through — Phase 1 has no automated
 * accrual job, so balances are seeded/maintained separately, and blocking
 * every application on a missing balance row would make the feature unusable
 * before that exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { leaveApplicationSchema } from '@/lib/validations/workforce';
import { validateLeaveSubmission, planSummary } from '@/lib/leave/submission';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';
import { checkRangeNotFrozen } from '@/lib/attendanceFreeze';

export async function GET(request: NextRequest) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const employeeIdParam = searchParams.get('employeeId');
  const queue = searchParams.get('queue'); // 'manager' | 'hr'

  // Stage 1 is gated on the org chart, not RBAC — a reporting manager holds no
  // workforce.leave.* grant, so checking the permission up front (as this route
  // used to) 403'd the manager queue and left the Leave Approval page blank for
  // every manager. Same split the mispunch route uses.
  let managerFilter: Record<string, unknown> = {};
  if (queue === 'manager') {
    const userId = Number(request.headers.get('x-user-id'));
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId) {
      return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
    }
    // Fail closed: without this filter the query below would fall through to
    // every leave application in the company.
    managerFilter = {
      status: 'pending_manager',
      employee: { reportingManagerId: ownEmployeeId, companyId: scope.companyId, deletedAt: null },
    };
  } else if (queue === 'actioned') {
    // What this caller has already decided, at either stage. Needs no grant:
    // filtered to their own recorded action, so it can only return decisions
    // they personally made. Without it an approval vanishes once actioned.
    const userId = Number(request.headers.get('x-user-id'));
    managerFilter = { OR: [{ managerActionByUserId: userId }, { approvedByUserId: userId }] };
  } else {
    const permErr = await checkSpecificPermission(request, 'workforce.leave.view');
    if (permErr) return permErr;
    if (queue === 'hr') managerFilter = { status: 'pending_hr' };
  }

  // `pending` is not a stored status — the two live stages are
  // pending_manager and pending_hr. Passing it straight to Prisma matched
  // nothing, which left the Leave Approval page permanently empty (and so
  // with no row actions). Treat it as "either stage still awaiting a decision".
  const statusFilter =
    status === 'pending' ? { status: { in: ['pending_manager', 'pending_hr'] } } : status ? { status } : {};

  const records = await prisma.leaveApplication.findMany({
    where: {
      employee: { companyId: scope.companyId, deletedAt: null },
      ...statusFilter,
      ...(employeeIdParam ? { employeeId: Number(employeeIdParam) } : {}),
      ...managerFilter,
    },
    include: {
      employee: { select: { id: true, oldEmployeeCode: true, firstName: true, lastName: true } },
      leaveMaster: { select: { id: true, code: true, name: true } },
    },
    orderBy: { appliedAt: 'desc' },
  });

  return NextResponse.json({ data: records });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.leave.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = leaveApplicationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { employeeId, leaveMasterId, fromDate, toDate, isHalfDay, reason } = parsed.data;

  const employee = await findEmployeeInCompany(employeeId, scope.companyId);
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const freezeErr = await checkRangeNotFrozen(employeeId, fromDate, isHalfDay ? fromDate : toDate);
  if (freezeErr) return freezeErr;

  const checked = await validateLeaveSubmission({ companyId: scope.companyId, employeeId, leaveMasterId, fromDate, toDate, isHalfDay });
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: checked.status });

  // A reporting manager applying for their own leave has no one at Stage 1
  // to act on it — isManagerOfAnyLevel would reject every caller, per
  // src/app/api/workforce/leave/applications/[id]/approve/route.ts. Skip
  // straight to HR for applicants who are themselves a reporting manager
  // (same "isManager" check as /api/auth/me), regardless of whether they
  // happen to have a reportingManagerId of their own.
  const isManagerApplicant =
    (await prisma.employee.count({
      where: { reportingManagerId: employeeId, deletedAt: null, isActive: true },
    })) > 0;

  const record = await prisma.leaveApplication.create({
    data: {
      employeeId,
      leaveMasterId,
      companyId: scope.companyId,
      fromDate: checked.fromDate,
      toDate: checked.toDate,
      numberOfDays: checked.plan.count,
      calendarDays: checked.plan.calendarDays,
      nonWorkingDaysCounted: checked.plan.nonWorkingCounted,
      isHalfDay,
      reason,
      status: isManagerApplicant ? 'pending_hr' : 'pending_manager',
    },
  });

  // Goes to the reporting manager, who has to act on it — not to the employee,
  // who just pressed the button.
  await notifyEssRequest({
    companyId: scope.companyId,
    kind: 'LEAVE',
    action: 'SUBMITTED',
    employeeId,
    requestId: record.id,
    period: formatPeriod(fromDate, toDate),
    reason: reason ?? undefined,
    linkPath: '/workforce/leave/approval',
  });

  return NextResponse.json({ ...record, plan: planSummary(checked.plan) }, { status: 201 });
}
