/**
 * Stage-2 (HR) leave approval side-effects, extracted so that every path
 * which lands a leave in `approved` runs exactly the same chain:
 *
 *   plan (working days only)  →  guards  →  balance ledger
 *   →  one DailyAttendance row per planned date (with history, linked to
 *      the application)  →  MonthlyAttendanceSummary refresh
 *   →  CompOff ledger debit (COMPOFF only)
 *
 * The approve route (POST .../[id]/approve) is the interactive caller; the
 * bulk approve and bulk import routes are the others. Keeping this in one
 * place is the whole point — a second implementation would drift and
 * silently desync balances from attendance.
 *
 * Leave core, 2026-09-25 (docs/TIME_OFFICE_FLAWS_QA_2026-09-25.md §9):
 *   - only working days are written and debited (computeLeaveDays);
 *   - a half day is HalfDay with punches kept and 0.5 debited;
 *   - unpaid types write LOP and touch no ledger;
 *   - a full-day leave is refused over a worked day (WORKED_DAY) and over a
 *     date another leave already wrote (OVERLAP);
 *   - the status flip is a guarded updateMany so two approvers cannot both
 *     debit (ALREADY_ACTIONED).
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { refreshMonthlySummary } from '@/lib/biometricConversion';
import { debitCompOff } from '@/lib/compOffTransactions';
import { getAttendanceLockInRange } from '@/lib/attendanceFreeze';
import { computeLeaveDays, describeDates, datesBetween, LEAVE_TX_OPTS, type LeavePlan } from '@/lib/leave/leaveDays';

export { datesBetween };

export interface LeaveApprovalTarget {
  id: number;
  companyId: number;
  employeeId: number;
  leaveMasterId: number;
  fromDate: Date;
  toDate: Date;
  numberOfDays: number;
  isHalfDay: boolean;
  /** LeaveMaster.code — 'COMPOFF' takes the comp-off ledger path. */
  leaveCode: string;
  /** LeaveMaster.isPaid — false: LOP days, no ledger. */
  isPaid: boolean;
  countSandwichedNonWorking: boolean;
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
  reason: 'FROZEN_MONTH' | 'INSUFFICIENT_BALANCE' | 'WORKED_DAY' | 'OVERLAP' | 'NO_WORKING_DAYS' | 'ALREADY_ACTIONED';
  message: string;
}

export class LeaveApprovalError extends Error {
  constructor(public block: LeaveApprovalBlock) {
    super(block.message);
  }
}

export function planFor(target: LeaveApprovalTarget): Promise<LeavePlan> {
  return computeLeaveDays({
    companyId: target.companyId,
    employeeId: target.employeeId,
    leaveMaster: { isPaid: target.isPaid, countSandwichedNonWorking: target.countSandwichedNonWorking },
    from: target.fromDate,
    to: target.toDate,
    isHalfDay: target.isHalfDay,
    excludeApplicationId: target.id || undefined,
  });
}

/**
 * Is ANY month touched by the range locked?
 *
 * Uses the single attendance lock rule (src/lib/attendanceFreeze.ts —
 * FROZEN, READY_FOR_PAYROLL, or payroll processed) and walks every month
 * between the two dates, not just the ends.
 */
export async function checkFrozenMonths(target: LeaveApprovalTarget): Promise<LeaveApprovalBlock | null> {
  const lock = await getAttendanceLockInRange(target.employeeId, target.fromDate, target.toDate);
  return lock ? { reason: 'FROZEN_MONTH', message: lock.message } : null;
}

/** The plan-derived guards: nothing to write, worked day, another leave's day. */
export function checkPlan(target: LeaveApprovalTarget, plan: LeavePlan): LeaveApprovalBlock | null {
  if (plan.count === 0) {
    return { reason: 'NO_WORKING_DAYS', message: 'No working days in this range — every date is a weekly off or holiday.' };
  }
  const worked = target.isHalfDay ? plan.workedFullDayDates : plan.punchedDates;
  if (worked.length > 0) {
    return {
      reason: 'WORKED_DAY',
      message: target.isHalfDay
        ? `A full day is already recorded on ${describeDates(worked)} — a half-day leave cannot be taken on it.`
        : `Attendance is already punched on ${describeDates(worked)} — leave cannot be applied for a worked day.`,
    };
  }
  if (plan.linkedDates.length > 0) {
    return {
      reason: 'OVERLAP',
      message: `${describeDates(plan.linkedDates.map((d) => d.date))} already belongs to leave application #${plan.linkedDates[0].leaveApplicationId}.`,
    };
  }
  return null;
}

/**
 * Does the employee hold enough balance for this leave? Unpaid types have
 * no ledger and always pass.
 *
 * `alreadyReserved` lets a batch caller account for earlier rows in the same
 * file that have not been committed yet — without it, two rows for one
 * employee can each pass on the stored figure and together overdraw it.
 */
export async function checkSufficientBalance(
  target: LeaveApprovalTarget,
  alreadyReserved = 0
): Promise<LeaveApprovalBlock | null> {
  if (!target.isPaid) return null;
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

/**
 * Every guard, in the order the approve route applies them. `plan` is the
 * same object passed to commitLeaveApproval so nothing is computed twice.
 * The balance check uses the PLAN's count, not the stored numberOfDays —
 * holidays may have been declared since the application was filed.
 */
export async function checkCanApprove(
  target: LeaveApprovalTarget,
  plan: LeavePlan,
  alreadyReserved = 0
): Promise<LeaveApprovalBlock | null> {
  return (
    (await checkFrozenMonths(target)) ??
    checkPlan(target, plan) ??
    (await checkSufficientBalance({ ...target, numberOfDays: plan.count }, alreadyReserved))
  );
}

/**
 * Commits the approval: flips status (guarded), corrects the day count to
 * the plan, moves the ledger (paid, non-COMPOFF), writes one linked row per
 * planned date, refreshes each touched month, and debits the comp-off
 * ledger when the type is COMPOFF.
 *
 * Callers are expected to have run `checkCanApprove` first with the same plan.
 */
export async function commitLeaveApproval(
  target: LeaveApprovalTarget,
  plan: LeavePlan,
  userId: number | null
): Promise<void> {
  const year = target.fromDate.getUTCFullYear();
  const touchedMonths = new Set<string>();
  const days = plan.count;
  const label = `Leave #${target.id} (${target.leaveCode})`;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const flipped = await tx.leaveApplication.updateMany({
      where: { id: target.id, status: 'pending_hr' },
      data: {
        status: 'approved',
        approvedByUserId: userId,
        approvedAt: new Date(),
        numberOfDays: days,
        calendarDays: plan.calendarDays,
        nonWorkingDaysCounted: plan.nonWorkingCounted,
      },
    });
    if (flipped.count === 0) {
      throw new LeaveApprovalError({ reason: 'ALREADY_ACTIONED', message: 'This application has already been actioned.' });
    }

    if (target.isPaid && target.leaveCode !== 'COMPOFF') {
      await tx.leaveBalance.upsert({
        where: {
          employeeId_leaveMasterId_year: {
            employeeId: target.employeeId,
            leaveMasterId: target.leaveMasterId,
            year,
          },
        },
        update: {
          availed: { increment: days },
          closingBalance: { decrement: days },
        },
        create: {
          employeeId: target.employeeId,
          leaveMasterId: target.leaveMasterId,
          year,
          availed: days,
          closingBalance: -days,
        },
      });
    }

    const punched = new Set(plan.punchedDates.map((d) => d.getTime()));
    for (const entry of plan.dates) {
      const link = { leaveApplicationId: target.id, leaveDayKind: entry.kind, source: 'manual' as const };
      if (entry.kind === 'HALF') {
        // Half day: the worked half's punches stay; the day is half leave.
        await upsertDailyAttendanceWithHistory(
          tx,
          target.employeeId,
          entry.date,
          { ...link, status: 'HalfDay', remarks: `Half-day ${label}` },
          { userId, changedBySource: 'manual' }
        );
      } else {
        // Full leave day (paid → Leave, unpaid / sandwiched → LOP): a clean
        // row, no punch data left underneath the status.
        const hadPunches = punched.has(entry.date.getTime());
        await upsertDailyAttendanceWithHistory(
          tx,
          target.employeeId,
          entry.date,
          {
            ...link,
            status: target.isPaid ? 'Leave' : 'LOP',
            inTime: null,
            outTime: null,
            workingMinutes: 0,
            lateMinutes: 0,
            earlyOutMinutes: 0,
            ...(hadPunches ? { otMinutesCalculated: 0 } : {}),
            remarks: entry.kind === 'SANDWICH' ? `Weekly off sandwiched by ${label}` : label,
          },
          { userId, changedBySource: 'manual' }
        );
      }
      touchedMonths.add(`${entry.date.getUTCFullYear()}-${entry.date.getUTCMonth() + 1}`);
    }
  }, LEAVE_TX_OPTS);

  for (const key of touchedMonths) {
    const [y, m] = key.split('-').map(Number);
    await refreshMonthlySummary(target.employeeId, y, m);
  }

  if (target.leaveCode === 'COMPOFF') {
    await debitCompOff(
      target.employeeId,
      days,
      target.fromDate,
      'LEAVE',
      target.id,
      `Comp-off leave approved (${days} day(s))`
    );
  }
}
