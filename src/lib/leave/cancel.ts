/**
 * Cancelling a leave application — one implementation for the employee
 * (my-leave) and HR (leave/applications) routes.
 *
 * Pending: status flip only, nothing was written yet.
 * Approved: every day the approval wrote (linked by leaveApplicationId) is
 * put back to what the evidence says via restoreLeaveDay — punches if any,
 * weekly off / holiday, else Absent — never a blanket LOP. The balance is
 * refunded for what is still debited (numberOfDays, already net of days
 * HR gave back), the
 * comp-off ledger for COMPOFF, nothing for unpaid types.
 *
 * Leaves approved before 2026-09-25 whose rows the migration could not link
 * (a date covered by two approved applications) fall back to the old
 * "still status Leave inside the range" heuristic.
 */

import { prisma } from '@/lib/prisma';
import type { LeaveApplication } from '@prisma/client';
import { refreshMonthlySummary } from '@/lib/biometricConversion';
import { creditCompOff } from '@/lib/compOffTransactions';
import { getAttendanceLockInRange } from '@/lib/attendanceFreeze';
import { buildRestoreContext, restoreLeaveDay, LEAVE_TX_OPTS } from '@/lib/leave/leaveDays';

export const CANCELLABLE_STATUSES = ['pending_manager', 'pending_hr', 'approved'] as const;

export type CancelResult =
  | { ok: true; restoredDays: number; refundedDays: number }
  | { ok: false; status: 409; error: string };

export async function cancelLeaveApplication(
  application: LeaveApplication & { leaveMaster: { code: string; isPaid: boolean } },
  companyId: number,
  userId: number | null
): Promise<CancelResult> {
  if (!(CANCELLABLE_STATUSES as readonly string[]).includes(application.status)) {
    return { ok: false, status: 409, error: `Cannot cancel a ${application.status} application` };
  }
  const wasApproved = application.status === 'approved';

  if (wasApproved) {
    const lock = await getAttendanceLockInRange(application.employeeId, application.fromDate, application.toDate);
    if (lock) return { ok: false, status: 409, error: lock.message };
  }

  // numberOfDays is reduced in step with daysReversed on every 'present'
  // decision, so what is still debited is numberOfDays itself.
  const refund = Math.max(0, Number(application.numberOfDays));
  const year = application.fromDate.getUTCFullYear();
  const touchedMonths = new Set<string>();
  let restoredDays = 0;

  const ctx = wasApproved
    ? await buildRestoreContext(companyId, application.employeeId, application.fromDate, application.toDate, userId)
    : null;

  const flipped = await prisma.$transaction(async (tx) => {
    const res = await tx.leaveApplication.updateMany({
      where: { id: application.id, status: { in: [...CANCELLABLE_STATUSES] } },
      data: { status: 'cancelled', cancelledAt: new Date(), cancelledByUserId: userId },
    });
    if (res.count === 0) return false;
    if (!wasApproved || !ctx) return true;

    if (application.leaveMaster.isPaid && application.leaveMaster.code !== 'COMPOFF' && refund > 0) {
      await tx.leaveBalance.updateMany({
        where: { employeeId: application.employeeId, leaveMasterId: application.leaveMasterId, year },
        data: { availed: { decrement: refund }, closingBalance: { increment: refund } },
      });
    }

    let rows = await tx.dailyAttendance.findMany({ where: { leaveApplicationId: application.id }, orderBy: { date: 'asc' } });
    if (rows.length === 0) {
      // Legacy (pre-link) approval: the old heuristic.
      rows = await tx.dailyAttendance.findMany({
        where: {
          employeeId: application.employeeId,
          date: { gte: application.fromDate, lte: application.toDate },
          status: 'Leave',
          leaveApplicationId: null,
        },
        orderBy: { date: 'asc' },
      });
      rows = rows.map((r) => ({ ...r, leaveApplicationId: application.id, leaveDayKind: 'LEAVE' }));
    }
    for (const row of rows) {
      await restoreLeaveDay(tx, row, ctx);
      restoredDays += 1;
      touchedMonths.add(`${row.date.getUTCFullYear()}-${row.date.getUTCMonth() + 1}`);
    }
    return true;
  }, LEAVE_TX_OPTS);

  if (!flipped) return { ok: false, status: 409, error: 'This application has already been actioned.' };

  for (const key of touchedMonths) {
    const [y, m] = key.split('-').map(Number);
    await refreshMonthlySummary(application.employeeId, y, m);
  }

  if (wasApproved && application.leaveMaster.code === 'COMPOFF' && refund > 0) {
    await creditCompOff(
      application.employeeId,
      refund,
      application.fromDate,
      'LEAVE_CANCELLED',
      application.id,
      `Comp-off leave #${application.id} cancelled (${refund} day(s) returned)`
    );
  }

  return { ok: true, restoredDays, refundedDays: wasApproved ? refund : 0 };
}
