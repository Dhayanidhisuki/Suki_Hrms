/**
 * POST /api/workforce/leave/applications/[id]/approve
 *
 * Per BRD §11: approving leave must (a) deduct from the balance ledger and
 * (b) automatically update attendance. In one transaction: flips the
 * application to approved, upserts LeaveBalance.availed/closingBalance, and
 * marks every date in [fromDate, toDate] as a "Leave" day in DailyAttendance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';

function datesBetween(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'workforce.leave.approve');
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
  if (application.status !== 'pending') {
    return NextResponse.json({ error: `Cannot approve a ${application.status} application` }, { status: 409 });
  }

  // Approving writes DailyAttendance rows (below) — block if either end of
  // the range falls in a frozen month (per-day checks for a range spanning
  // 3+ months are not done in Phase 1; rare enough to accept for now).
  const freezeErrFrom = await checkMonthNotFrozen(application.employeeId, application.fromDate);
  if (freezeErrFrom) return freezeErrFrom;
  const freezeErrTo = await checkMonthNotFrozen(application.employeeId, application.toDate);
  if (freezeErrTo) return freezeErrTo;

  const userId = Number(request.headers.get('x-user-id'));
  const numberOfDays = Number(application.numberOfDays);
  const year = application.fromDate.getUTCFullYear();

  const [updated] = await prisma.$transaction([
    prisma.leaveApplication.update({
      where: { id: applicationId },
      data: { status: 'approved', approvedByUserId: userId, approvedAt: new Date() },
    }),
    prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveMasterId_year: {
          employeeId: application.employeeId,
          leaveMasterId: application.leaveMasterId,
          year,
        },
      },
      update: {
        availed: { increment: numberOfDays },
        closingBalance: { decrement: numberOfDays },
      },
      // No prior balance row: Phase 1 has no accrual job yet, so this seeds
      // one at zero opening balance — closingBalance goes negative, which is
      // visible on the Leave History screen as "over-availed" for HR to
      // reconcile once real balances are set up.
      create: {
        employeeId: application.employeeId,
        leaveMasterId: application.leaveMasterId,
        year,
        availed: numberOfDays,
        closingBalance: -numberOfDays,
      },
    }),
    ...datesBetween(application.fromDate, application.toDate).map((date) =>
      prisma.dailyAttendance.upsert({
        where: { employeeId_date: { employeeId: application.employeeId, date } },
        update: { status: 'Leave' },
        create: { employeeId: application.employeeId, date, status: 'Leave', source: 'manual' },
      })
    ),
  ]);

  return NextResponse.json(updated);
}
