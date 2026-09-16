/**
 * POST /api/workforce/my-leave/[id]/cancel
 *   The logged-in employee cancels one of their own leave applications.
 *   Cancellable from any non-terminal state (pending_manager, pending_hr)
 *   or from approved. Per BRD §11, "Cancelled leave shall restore the
 *   applicable balance" — if it was approved, reverses the LeaveBalance
 *   deduction and clears the "Leave" DailyAttendance rows this application
 *   created (same heuristic as the HR-side cancel route: no FK links a
 *   DailyAttendance row back to the application that created it in Phase 1,
 *   so a day manually re-marked to something else after approval is
 *   deliberately left alone).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { refreshMonthlySummary } from '@/lib/biometricConversion';

const CANCELLABLE_STATUSES = ['pending_manager', 'pending_hr', 'approved'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const { id } = await params;
  const applicationId = Number(id);

  const application = await prisma.leaveApplication.findFirst({
    where: { id: applicationId, employeeId: ownEmployeeId },
  });
  if (!application) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!CANCELLABLE_STATUSES.includes(application.status)) {
    return NextResponse.json({ error: `Cannot cancel a ${application.status} application` }, { status: 409 });
  }

  const wasApproved = application.status === 'approved';
  const numberOfDays = Number(application.numberOfDays);
  const year = application.fromDate.getUTCFullYear();

  if (wasApproved) {
    const freezeErrFrom = await checkMonthNotFrozen(application.employeeId, application.fromDate);
    if (freezeErrFrom) return freezeErrFrom;
    const freezeErrTo = await checkMonthNotFrozen(application.employeeId, application.toDate);
    if (freezeErrTo) return freezeErrTo;
  }

  const touchedMonths = new Set<string>();

  await prisma.$transaction(async (tx) => {
    await tx.leaveApplication.update({
      where: { id: applicationId },
      data: { status: 'cancelled' },
    });

    if (wasApproved) {
      await tx.leaveBalance.updateMany({
        where: { employeeId: application.employeeId, leaveMasterId: application.leaveMasterId, year },
        data: { availed: { decrement: numberOfDays }, closingBalance: { increment: numberOfDays } },
      });

      const leaveRows = await tx.dailyAttendance.findMany({
        where: {
          employeeId: application.employeeId,
          date: { gte: application.fromDate, lte: application.toDate },
          status: 'Leave',
        },
      });

      for (const row of leaveRows) {
        await upsertDailyAttendanceWithHistory(
          tx,
          application.employeeId,
          row.date,
          { status: 'LOP' },
          { userId, changedBySource: 'manual' }
        );
        touchedMonths.add(`${row.date.getUTCFullYear()}-${row.date.getUTCMonth() + 1}`);
      }
    }
  });

  for (const key of touchedMonths) {
    const [y, m] = key.split('-').map(Number);
    await refreshMonthlySummary(application.employeeId, y, m);
  }

  return NextResponse.json({ message: 'Leave application cancelled' });
}
