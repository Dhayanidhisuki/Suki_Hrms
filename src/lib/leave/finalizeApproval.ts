/**
 * Stage-2 (HR) leave approval side-effects, extracted so that every path
 * which lands a leave in `approved` runs exactly the same chain:
 *
 *   balance ledger  →  DailyAttendance per date (with history)
 *   →  MonthlyAttendanceSummary refresh  →  CompOff ledger debit (COMPOFF only)
 *
 * The approve route (POST .../[id]/approve) is the interactive caller; the
 * bulk leave importer is the other. Keeping this in one place is the whole
 * point — a second implementation would drift and silently desync balances
 * from attendance.
 *
 * Guards (frozen month, insufficient balance) are exposed separately from
 * the commit so callers can run them as a dry run — the importer needs to
 * report every failing row up front rather than discovering them mid-write.
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { refreshMonthlySummary } from '@/lib/biometricConversion';
import { debitCompOff } from '@/lib/compOffTransactions';

export function datesBetween(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export interface LeaveApprovalTarget {
  id: number;
  employeeId: number;
  leaveMasterId: number;
  fromDate: Date;
  toDate: Date;
  numberOfDays: number;
  /** LeaveMaster.code — 'COMPOFF' takes the comp-off ledger path. */
  leaveCode: string;
}

/** One row's outcome from a bulk approve/reject, for the UI's results table. */
export interface BulkLeaveResult {
  id: number;
  status: 'ok' | 'skipped' | 'error';
  stage?: 'manager' | 'hr';
  employeeCode?: string;
  message?: string;
}

/** A guard failure, shaped so callers can turn it into a 409 or a row error. */
export interface LeaveApprovalBlock {
  reason: 'FROZEN_MONTH' | 'INSUFFICIENT_BALANCE';
  message: string;
}

/**
 * Is either end of the range in a frozen month?
 *
 * Mirrors checkMonthNotFrozen, but returns a plain result instead of a
 * NextResponse so it is usable outside a route. Note only FROZEN blocks —
 * FINALIZED and READY_FOR_PAYROLL months remain writable, matching the
 * behaviour of every other attendance write path.
 */
export async function checkFrozenMonths(target: LeaveApprovalTarget): Promise<LeaveApprovalBlock | null> {
  const ends = [target.fromDate, target.toDate];
  for (const date of ends) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const summary = await prisma.monthlyAttendanceSummary.findUnique({
      where: { employeeId_year_month: { employeeId: target.employeeId, year, month } },
      select: { status: true },
    });
    if (summary?.status === 'FROZEN') {
      return {
        reason: 'FROZEN_MONTH',
        message: `Attendance for ${year}-${String(month).padStart(2, '0')} is frozen. Reopen the month first.`,
      };
    }
  }
  return null;
}

/**
 * Does the employee hold enough balance for this leave?
 *
 * `alreadyReserved` lets a batch caller account for earlier rows in the same
 * file that have not been committed yet — without it, two rows for one
 * employee can each pass on the stored figure and together overdraw it.
 */
export async function checkSufficientBalance(
  target: LeaveApprovalTarget,
  alreadyReserved = 0
): Promise<LeaveApprovalBlock | null> {
  const year = target.fromDate.getUTCFullYear();

  if (target.leaveCode === 'COMPOFF') {
    const compOff = await prisma.compOffBalance.findUnique({ where: { employeeId: target.employeeId } });
    const available = (compOff ? Number(compOff.balance) : 0) - alreadyReserved;
    if (available < target.numberOfDays) {
      return {
        reason: 'INSUFFICIENT_BALANCE',
        message: `Insufficient comp-off balance: ${available.toFixed(2)} day(s) available, ${target.numberOfDays} requested`,
      };
    }
    return null;
  }

  const leaveBalance = await prisma.leaveBalance.findUnique({
    where: {
      employeeId_leaveMasterId_year: {
        employeeId: target.employeeId,
        leaveMasterId: target.leaveMasterId,
        year,
      },
    },
  });
  const available = (leaveBalance ? Number(leaveBalance.closingBalance) : 0) - alreadyReserved;
  if (available < target.numberOfDays) {
    return {
      reason: 'INSUFFICIENT_BALANCE',
      message: `Insufficient ${target.leaveCode} balance: ${available.toFixed(2)} day(s) available, ${target.numberOfDays} requested`,
    };
  }
  return null;
}

/** Both guards, in the order the approve route applies them. */
export async function checkCanApprove(
  target: LeaveApprovalTarget,
  alreadyReserved = 0
): Promise<LeaveApprovalBlock | null> {
  return (await checkFrozenMonths(target)) ?? (await checkSufficientBalance(target, alreadyReserved));
}

/**
 * Commits the approval: flips status, moves the ledger, writes a Leave day
 * for every date in range, refreshes each touched month, and debits the
 * comp-off ledger when the type is COMPOFF.
 *
 * Callers are expected to have run `checkCanApprove` first — this does not
 * re-run the guards, exactly as the original route did not.
 */
export async function commitLeaveApproval(
  target: LeaveApprovalTarget,
  userId: number | null
): Promise<void> {
  const year = target.fromDate.getUTCFullYear();
  const leaveDates = datesBetween(target.fromDate, target.toDate);
  const touchedMonths = new Set<string>();

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.leaveApplication.update({
      where: { id: target.id },
      data: { status: 'approved', approvedByUserId: userId, approvedAt: new Date() },
    });

    // Comp-Off never gets a LeaveBalance row — it draws from CompOffBalance
    // instead (debited below via debitCompOff), same split
    // checkSufficientBalance already applies. Writing one here anyway
    // created a phantom "Compensatory Off" balance row alongside the real
    // ledger, showing as a duplicate/negative KPI card.
    if (target.leaveCode !== 'COMPOFF') {
      await tx.leaveBalance.upsert({
        where: {
          employeeId_leaveMasterId_year: {
            employeeId: target.employeeId,
            leaveMasterId: target.leaveMasterId,
            year,
          },
        },
        update: {
          availed: { increment: target.numberOfDays },
          closingBalance: { decrement: target.numberOfDays },
        },
        create: {
          employeeId: target.employeeId,
          leaveMasterId: target.leaveMasterId,
          year,
          availed: target.numberOfDays,
          closingBalance: -target.numberOfDays,
        },
      });
    }

    for (const date of leaveDates) {
      // An employee who actually came in and punched on an approved leave
      // day (comp-off or otherwise) keeps their real Present attendance —
      // stamping it 'Leave' would erase a genuine punch. The day still
      // reads as "on approved leave" via the LeaveApplication itself; the
      // UI composes that into a "Present (Leave/Comp-Off Applied)" badge
      // rather than this write silently overwriting what happened.
      const existing = await tx.dailyAttendance.findUnique({
        where: { employeeId_date: { employeeId: target.employeeId, date } },
        select: { status: true },
      });
      if (existing?.status === 'Present') {
        touchedMonths.add(`${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`);
        continue;
      }

      await upsertDailyAttendanceWithHistory(
        tx,
        target.employeeId,
        date,
        { status: 'Leave', source: 'manual' },
        { userId, changedBySource: 'manual' }
      );
      touchedMonths.add(`${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`);
    }
  });

  for (const key of touchedMonths) {
    const [y, m] = key.split('-').map(Number);
    await refreshMonthlySummary(target.employeeId, y, m);
  }

  if (target.leaveCode === 'COMPOFF') {
    await debitCompOff(
      target.employeeId,
      target.numberOfDays,
      target.fromDate,
      'LEAVE',
      target.id,
      `Comp-off leave approved (${target.numberOfDays} day(s))`
    );
  }
}
