/**
 * POST /api/workforce/leave/applications/[id]/cancel
 *
 * Cancellable from pending or approved. Per BRD §11, "Cancelled leave shall
 * restore the applicable balance" — if it was approved, reverses the
 * LeaveBalance deduction and clears the "Leave" DailyAttendance rows this
 * application created. (Heuristic: clears rows in [fromDate, toDate] that
 * are still status "Leave" — there's no FK linking a DailyAttendance row
 * back to the application that created it in Phase 1, so a day manually
 * re-marked to something else after approval is deliberately left alone.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';

import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { refreshMonthlySummary } from '@/lib/biometricConversion';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'workforce.leave.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const applicationId = parseInt(id);

  const application = await prisma.leaveApplication.findFirst({
    where: { id: applicationId, employee: { companyId: scope.companyId, deletedAt: null } },
  });
  if (!application) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (application.status !== 'pending' && application.status !== 'approved') {
    return NextResponse.json({ error: `Cannot cancel a ${application.status} application` }, { status: 409 });
  }

  const wasApproved = application.status === 'approved';
  const numberOfDays = Number(application.numberOfDays);
  const year = application.fromDate.getUTCFullYear();
  const userId = Number(request.headers.get('x-user-id'));

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
