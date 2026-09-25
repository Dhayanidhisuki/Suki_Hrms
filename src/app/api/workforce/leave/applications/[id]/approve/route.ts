/**
 * POST /api/workforce/leave/applications/[id]/approve
 *
 * Two-stage approval (Manager → HR), per BRD §11:
 *   Stage 1 (pending_manager): only the employee's own Reporting Manager
 *     (Level 1 or Level 2) may act. Advances to pending_hr. No balance
 *     deduction or attendance write yet.
 *   Stage 2 (pending_hr): requires workforce.leave.approve. Deducts from
 *     the balance ledger, marks every date in [fromDate, toDate] as a
 *     "Leave" day in DailyAttendance, and flips the application to
 *     approved.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId, isManagerOfAnyLevel } from '@/lib/reportingManager';
import { checkCanApprove, commitLeaveApproval, planFor, LeaveApprovalError, type LeaveApprovalTarget } from '@/lib/leave/finalizeApproval';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const applicationId = parseInt(id);
  const userId = Number(request.headers.get('x-user-id'));

  const application = await prisma.leaveApplication.findFirst({
    where: { id: applicationId, employee: { companyId: scope.companyId, deletedAt: null } },
    include: { leaveMaster: { select: { code: true, isPaid: true, countSandwichedNonWorking: true } } },
  });
  if (!application) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // ── Stage 1: Manager approval ──────────────────────────────────────────
  if (application.status === 'pending_manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId || !(await isManagerOfAnyLevel(ownEmployeeId, application.employeeId))) {
      return NextResponse.json(
        { error: "Forbidden — only the employee's Reporting Manager can approve this stage" },
        { status: 403 }
      );
    }
    const updated = await prisma.leaveApplication.update({
      where: { id: applicationId },
      data: {
        status: 'pending_hr',
        managerActionByUserId: userId,
        managerActionAt: new Date(),
      },
    });
    return NextResponse.json({ message: 'Approved by manager, forwarded to HR', data: updated });
  }

  // ── Stage 2: HR approval ───────────────────────────────────────────────
  if (application.status === 'pending_hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.leave.approve');
    if (permErr) return permErr;

    const target: LeaveApprovalTarget = {
      id: applicationId,
      companyId: scope.companyId,
      employeeId: application.employeeId,
      leaveMasterId: application.leaveMasterId,
      fromDate: application.fromDate,
      toDate: application.toDate,
      numberOfDays: Number(application.numberOfDays),
      isHalfDay: application.isHalfDay,
      leaveCode: application.leaveMaster.code,
      isPaid: application.leaveMaster.isPaid,
      countSandwichedNonWorking: application.leaveMaster.countSandwichedNonWorking,
    };

    // Approving writes DailyAttendance rows and moves the balance ledger —
    // the guards live with the commit so the bulk paths apply them
    // identically. One plan feeds both so nothing is computed twice.
    const plan = await planFor(target);
    const blocked = await checkCanApprove(target, plan);
    if (blocked) return NextResponse.json({ error: blocked.message, reason: blocked.reason }, { status: 409 });

    try {
      await commitLeaveApproval(target, plan, userId || null);
    } catch (err) {
      if (err instanceof LeaveApprovalError) return NextResponse.json({ error: err.message, reason: err.block.reason }, { status: 409 });
      throw err;
    }

    // Final stage only: at pending_manager the application has merely moved on,
    // which is not an outcome the employee needs telling about.
    await notifyEssRequest({
      companyId: scope.companyId,
      kind: 'LEAVE',
      action: 'APPROVED',
      employeeId: application.employeeId,
      requestId: applicationId,
      period: formatPeriod(application.fromDate, application.toDate),
      linkPath: '/ess/leave',
    });

    const updated = await prisma.leaveApplication.findUnique({ where: { id: applicationId } });
    return NextResponse.json(updated);
  }

  return NextResponse.json(
    { error: `Cannot approve a ${application.status} application` },
    { status: 409 }
  );
}
