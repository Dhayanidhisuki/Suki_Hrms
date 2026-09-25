/**
 * What every leave submission path (employee self-service, HR on behalf)
 * checks before an application is created. One place so the two routes
 * cannot drift.
 *
 * Client rules (docs/TIME_OFFICE_FLAWS_QA_2026-09-25.md §9): the server
 * computes the day count from working days; a full-day leave is refused on a
 * date that already has a punch-in; a half-day is refused only on a full
 * Present day; overlapping requests are refused; balance is checked against
 * the computed count (unpaid types have no balance); the ledger is debited
 * at approval, not here.
 */

import { prisma } from '@/lib/prisma';
import { getCompOffBalance } from '@/lib/compOffTransactions';
import { computeLeaveDays, describeDates, utcMidnight, type LeavePlan } from '@/lib/leave/leaveDays';

export interface SubmissionInput {
  companyId: number;
  employeeId: number;
  leaveMasterId: number;
  fromDate: Date;
  toDate: Date;
  isHalfDay: boolean;
}

export type SubmissionResult =
  | { ok: true; plan: LeavePlan; fromDate: Date; toDate: Date; leaveMaster: { id: number; code: string; name: string; isPaid: boolean; halfDayAllowed: boolean } }
  | { ok: false; status: 400 | 409; error: string };

export async function validateLeaveSubmission(input: SubmissionInput): Promise<SubmissionResult> {
  const leaveMaster = await prisma.leaveMaster.findFirst({
    where: { id: input.leaveMasterId, isActive: true, deletedAt: null },
    select: { id: true, code: true, name: true, isPaid: true, halfDayAllowed: true, countSandwichedNonWorking: true },
  });
  if (!leaveMaster) return { ok: false, status: 400, error: 'Invalid or inactive leave type' };

  const fromDate = utcMidnight(input.fromDate);
  const toDate = input.isHalfDay ? fromDate : utcMidnight(input.toDate);
  if (toDate < fromDate) return { ok: false, status: 400, error: 'toDate cannot be before fromDate' };
  if (input.isHalfDay && !leaveMaster.halfDayAllowed) {
    return { ok: false, status: 400, error: `${leaveMaster.name} cannot be taken as a half day` };
  }

  const plan = await computeLeaveDays({
    companyId: input.companyId,
    employeeId: input.employeeId,
    leaveMaster,
    from: fromDate,
    to: toDate,
    isHalfDay: input.isHalfDay,
  });

  if (plan.count === 0) {
    return { ok: false, status: 400, error: 'No working days in this range — every date is a weekly off or holiday.' };
  }
  const worked = input.isHalfDay ? plan.workedFullDayDates : plan.punchedDates;
  if (worked.length > 0) {
    return {
      ok: false,
      status: 400,
      error: input.isHalfDay
        ? `A full day is already recorded on ${describeDates(worked)} — a half-day leave cannot be taken on it.`
        : `Attendance is already punched on ${describeDates(worked)} — leave cannot be applied for a worked day.`,
    };
  }

  // Overlap with anything still open or approved. The friendly early check;
  // approval closes the race with the OVERLAP guard on linked rows.
  const clash = await prisma.leaveApplication.findFirst({
    where: {
      employeeId: input.employeeId,
      status: { in: ['pending_manager', 'pending_hr', 'approved'] },
      fromDate: { lte: toDate },
      toDate: { gte: fromDate },
    },
    select: { id: true, fromDate: true, toDate: true, status: true },
  });
  if (clash) {
    return {
      ok: false,
      status: 409,
      error: `Overlaps leave application #${clash.id} (${describeDates([clash.fromDate])} – ${describeDates([clash.toDate])}, ${clash.status.replace('_', ' ')}).`,
    };
  }

  if (leaveMaster.isPaid) {
    if (leaveMaster.code === 'COMPOFF') {
      const compOff = await getCompOffBalance(input.employeeId);
      const available = Number(compOff.balance);
      if (available < plan.count) {
        return { ok: false, status: 400, error: `Insufficient comp-off balance: ${available.toFixed(2)} day(s) available, ${plan.count} requested` };
      }
    } else {
      const balance = await prisma.leaveBalance.findUnique({
        where: { employeeId_leaveMasterId_year: { employeeId: input.employeeId, leaveMasterId: leaveMaster.id, year: fromDate.getUTCFullYear() } },
      });
      if (balance && Number(balance.closingBalance) < plan.count) {
        return { ok: false, status: 400, error: `Insufficient ${leaveMaster.code} balance: ${balance.closingBalance} available, ${plan.count} requested` };
      }
    }
  }

  return { ok: true, plan, fromDate, toDate, leaveMaster };
}

/** The part of a plan the UI shows before submitting. */
export function planSummary(plan: LeavePlan) {
  return {
    count: plan.count,
    calendarDays: plan.calendarDays,
    nonWorkingCounted: plan.nonWorkingCounted,
    skippedDates: plan.skippedDates.map((s) => ({ date: s.date.toISOString().slice(0, 10), reason: s.reason })),
    punchedDates: plan.punchedDates.map((d) => d.toISOString().slice(0, 10)),
    workedFullDayDates: plan.workedFullDayDates.map((d) => d.toISOString().slice(0, 10)),
    sandwichDates: plan.dates.filter((d) => d.kind === 'SANDWICH').map((d) => d.date.toISOString().slice(0, 10)),
  };
}
