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
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { resolveOwnEmployeeId, isManagerOfAnyLevel } from '@/lib/reportingManager';

import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { refreshMonthlySummary } from '@/lib/biometricConversion';

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
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const applicationId = parseInt(id);
  const userId = Number(request.headers.get('x-user-id'));

  const application = await prisma.leaveApplication.findFirst({
    where: { id: applicationId, employee: { companyId: scope.companyId, deletedAt: null } },
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

    // Approving writes DailyAttendance rows (below) — block if either end of
    // the range falls in a frozen month.
    const freezeErrFrom = await checkMonthNotFrozen(application.employeeId, application.fromDate);
    if (freezeErrFrom) return freezeErrFrom;
    const freezeErrTo = await checkMonthNotFrozen(application.employeeId, application.toDate);
    if (freezeErrTo) return freezeErrTo;

    const numberOfDays = Number(application.numberOfDays);
    const year = application.fromDate.getUTCFullYear();
    const touchedMonths = new Set<string>();
    const leaveDates = datesBetween(application.fromDate, application.toDate);

    const updated = await prisma.$transaction(async (tx) => {
      const app = await tx.leaveApplication.update({
        where: { id: applicationId },
        data: { status: 'approved', approvedByUserId: userId, approvedAt: new Date() },
      });

      await tx.leaveBalance.upsert({
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
        create: {
          employeeId: application.employeeId,
          leaveMasterId: application.leaveMasterId,
          year,
          availed: numberOfDays,
          closingBalance: -numberOfDays,
        },
      });

      for (const date of leaveDates) {
        await upsertDailyAttendanceWithHistory(
          tx,
          application.employeeId,
          date,
          { status: 'Leave', source: 'manual' },
          { userId, changedBySource: 'manual' }
        );
        touchedMonths.add(`${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`);
      }

      return app;
    });

    for (const key of touchedMonths) {
      const [y, m] = key.split('-').map(Number);
      await refreshMonthlySummary(application.employeeId, y, m);
    }

    return NextResponse.json(updated);
  }

  return NextResponse.json(
    { error: `Cannot approve a ${application.status} application` },
    { status: 409 }
  );
}
