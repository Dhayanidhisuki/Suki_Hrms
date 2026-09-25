/**
 * Leave core — which dates a leave actually covers, and how a leave day is
 * put back.
 *
 * Client decisions (docs/TIME_OFFICE_FLAWS_QA_2026-09-25.md §9):
 *   - Paid leave never covers a weekly off or holiday inside its range and
 *     never debits one.
 *   - Unpaid (LeaveMaster.isPaid = false) leave: a weekly off / holiday
 *     between two leave days is LOP too ("sandwich"), switched by
 *     LeaveMaster.countSandwichedNonWorking.
 *   - Half-day = 0.5, one date, punches kept. Punches on a half-day are
 *     normal; only a FULL day worked (status Present) blocks it.
 *   - Full-day leave cannot be applied for a date that already has a
 *     punch-in.
 *
 * One plan object (computeLeaveDays) feeds submission, approval and the
 * preview endpoint, so the count the employee sees is the count that is
 * debited and the rows that are written.
 */

import { prisma } from '@/lib/prisma';
import type { Prisma, PrismaClient, DailyAttendance } from '@prisma/client';
import { buildWeeklyOffResolver, buildHolidayLookup, type WeeklyOffResolver } from '@/lib/weeklyOff';
import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import {
  deriveStatusAndMinutes,
  resolveEmployeeShiftConfig,
  resolveDailyShiftWithOverride,
  type EmployeeShiftConfig,
} from '@/lib/biometricConversion';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Approval / cancel / resolve write one row per leave day inside a
 * transaction; a 20-day leave is ~100 round trips, well past Prisma's 5 s
 * default on a remote SQL Server. Same shape as the workflow engine's TX_OPTS.
 */
export const LEAVE_TX_OPTS = { maxWait: 10_000, timeout: 60_000 };

export type LeaveDayKind = 'LEAVE' | 'HALF' | 'SANDWICH';

export interface LeaveDayPlanEntry {
  date: Date;
  kind: LeaveDayKind;
}

export interface LeavePlan {
  /** Dates that will be written, in order. */
  dates: LeaveDayPlanEntry[];
  /** Days to debit: 0.5 for a half day, else LEAVE + SANDWICH dates. */
  count: number;
  calendarDays: number;
  /** Non-working dates counted because they were sandwiched (unpaid only). */
  nonWorkingCounted: number;
  skippedDates: { date: Date; reason: 'WeeklyOff' | 'Holiday' }[];
  /** Working dates in the plan that already carry a punch-in. */
  punchedDates: Date[];
  /** Working dates in the plan already recorded as a full Present day. */
  workedFullDayDates: Date[];
  /** Plan dates already written by ANOTHER leave application. */
  linkedDates: { date: Date; leaveApplicationId: number }[];
}

export interface LeaveMasterRules {
  isPaid: boolean;
  countSandwichedNonWorking: boolean;
}

export function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function datesBetween(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const cursor = utcMidnight(from);
  const end = utcMidnight(to);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function computeLeaveDays(input: {
  companyId: number;
  employeeId: number;
  leaveMaster: LeaveMasterRules;
  from: Date;
  to: Date;
  isHalfDay: boolean;
  /** When re-planning an existing application, its own rows are not "another" leave. */
  excludeApplicationId?: number;
}): Promise<LeavePlan> {
  const from = utcMidnight(input.from);
  const to = input.isHalfDay ? from : utcMidnight(input.to);
  const all = datesBetween(from, to);

  const [weeklyOff, holidays, rows] = await Promise.all([
    buildWeeklyOffResolver(input.companyId, [input.employeeId]),
    buildHolidayLookup(input.companyId, from, to),
    prisma.dailyAttendance.findMany({
      where: { employeeId: input.employeeId, date: { gte: from, lte: to } },
      select: { date: true, status: true, inTime: true, outTime: true, leaveApplicationId: true },
    }),
  ]);
  const rowByDate = new Map(rows.map((r) => [ymd(r.date), r]));

  const skippedDates: LeavePlan['skippedDates'] = [];
  const working: Date[] = [];
  const nonWorkingReason = new Map<string, 'WeeklyOff' | 'Holiday'>();
  for (const date of all) {
    if (weeklyOff.isWeeklyOff(input.employeeId, date)) nonWorkingReason.set(ymd(date), 'WeeklyOff');
    else if (holidays.has(ymd(date))) nonWorkingReason.set(ymd(date), 'Holiday');
    else working.push(date);
  }

  // Sandwich: a run of non-working dates with a leave day on BOTH sides,
  // inside the range. Unpaid types only.
  const sandwich = new Set<string>();
  if (!input.leaveMaster.isPaid && input.leaveMaster.countSandwichedNonWorking && !input.isHalfDay) {
    let seenWorking = false;
    let buffer: string[] = [];
    for (const date of all) {
      const key = ymd(date);
      if (nonWorkingReason.has(key)) {
        if (seenWorking) buffer.push(key);
      } else {
        for (const k of buffer) sandwich.add(k);
        buffer = [];
        seenWorking = true;
      }
    }
  }

  const dates: LeaveDayPlanEntry[] = [];
  for (const date of all) {
    const key = ymd(date);
    const reason = nonWorkingReason.get(key);
    if (!reason) dates.push({ date, kind: input.isHalfDay ? 'HALF' : 'LEAVE' });
    else if (sandwich.has(key)) dates.push({ date, kind: 'SANDWICH' });
    else skippedDates.push({ date, reason });
  }

  const punchedDates: Date[] = [];
  const workedFullDayDates: Date[] = [];
  const linkedDates: LeavePlan['linkedDates'] = [];
  for (const entry of dates) {
    const row = rowByDate.get(ymd(entry.date));
    if (!row) continue;
    if (row.inTime || row.outTime) punchedDates.push(entry.date);
    if (row.status === 'Present') workedFullDayDates.push(entry.date);
    if (row.leaveApplicationId != null && row.leaveApplicationId !== input.excludeApplicationId) {
      linkedDates.push({ date: entry.date, leaveApplicationId: row.leaveApplicationId });
    }
  }

  const leaveDates = dates.filter((d) => d.kind !== 'SANDWICH').length;
  const count = input.isHalfDay ? (leaveDates > 0 ? 0.5 : 0) : dates.length;

  return {
    dates,
    count,
    calendarDays: all.length,
    nonWorkingCounted: dates.filter((d) => d.kind === 'SANDWICH').length,
    skippedDates,
    punchedDates,
    workedFullDayDates,
    linkedDates,
  };
}

/** "Sun 11 Oct skipped" style text for messages. */
export function describeDates(dates: Date[]): string {
  return dates
    .map((d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }))
    .join(', ');
}

/**
 * Dates in `dates` already written by a leave approval. Other writers (WFH,
 * on-duty, mispunch, manual entry) refuse such dates instead of silently
 * orphaning the link. `allowHalf` lets a writer merge punches into a
 * half-day leave, which is normal.
 */
export async function findLinkedLeaveDates(
  employeeId: number,
  dates: Date[],
  opts: { excludeApplicationId?: number; allowHalf?: boolean } = {}
): Promise<{ date: Date; leaveApplicationId: number; leaveDayKind: string | null }[]> {
  if (dates.length === 0) return [];
  const rows = await prisma.dailyAttendance.findMany({
    where: {
      employeeId,
      date: { in: dates.map(utcMidnight) },
      leaveApplicationId: { not: null },
      ...(opts.excludeApplicationId ? { NOT: { leaveApplicationId: opts.excludeApplicationId } } : {}),
    },
    select: { date: true, leaveApplicationId: true, leaveDayKind: true },
  });
  return rows
    .filter((r) => !(opts.allowHalf && r.leaveDayKind === 'HALF'))
    .map((r) => ({ date: r.date, leaveApplicationId: r.leaveApplicationId as number, leaveDayKind: r.leaveDayKind }));
}

export function linkedLeaveMessage(linked: { date: Date; leaveApplicationId: number }[]): string {
  const first = linked[0];
  return `${describeDates([first.date])} is an approved leave day (application #${first.leaveApplicationId}). Cancel that leave or resolve its conflict first.`;
}

/** What a restore needs that is cheaper to resolve once per employee than per day. */
export interface RestoreContext {
  companyId: number;
  userId: number | null;
  shiftConfig: EmployeeShiftConfig;
  weeklyOff: WeeklyOffResolver;
  holidays: Set<string>;
}

export async function buildRestoreContext(companyId: number, employeeId: number, from: Date, to: Date, userId: number | null): Promise<RestoreContext> {
  const [shiftConfig, weeklyOff, holidays] = await Promise.all([
    resolveEmployeeShiftConfig(employeeId),
    buildWeeklyOffResolver(companyId, [employeeId]),
    buildHolidayLookup(companyId, utcMidnight(from), utcMidnight(to)),
  ]);
  return { companyId, userId, shiftConfig, weeklyOff, holidays };
}

/**
 * Put a leave day back to what the evidence says, never a blanket LOP:
 *   1. conflict punches (a punch that arrived on the leave day) → derived;
 *   2. the row's own punches (half-day) → derived;
 *   3. weekly off / holiday → that status;
 *   4. otherwise Absent (finalize may later make it LOP, as for any absence).
 * The link and kind are cleared; a decided conflict stays on the row for
 * audit. Source follows the punch that is being applied so the device may
 * still complete the pair later.
 */
export async function restoreLeaveDay(db: Db, row: DailyAttendance, ctx: RestoreContext): Promise<string> {
  const inTime = row.leaveConflictInTime ?? (row.leaveDayKind === 'HALF' ? row.inTime : null);
  const outTime = row.leaveConflictOutTime ?? (row.leaveDayKind === 'HALF' ? row.outTime : null);
  const actor = { userId: ctx.userId, changedBySource: 'manual' };
  const cleared = { leaveApplicationId: null, leaveDayKind: null };

  if (inTime || outTime) {
    const shift = await resolveDailyShiftWithOverride(row.employeeId, row.date, ctx.shiftConfig);
    const derived = deriveStatusAndMinutes(null, inTime, outTime, shift, ctx.shiftConfig.otThresholdMinutes, ctx.shiftConfig.maxOtMinutesPerDay);
    const status = inTime && outTime ? derived.status : 'MissingPunch';
    const worked = status !== 'Absent';
    await upsertDailyAttendanceWithHistory(
      db,
      row.employeeId,
      row.date,
      {
        ...cleared,
        status,
        inTime,
        outTime,
        workingMinutes: derived.workingMinutes,
        lateMinutes: derived.lateMinutes,
        earlyOutMinutes: derived.earlyOutMinutes,
        otMinutesCalculated: derived.otMinutes,
        shiftMasterId: shift.shiftMasterId,
        isWeeklyOffWorked: worked && ctx.weeklyOff.isWeeklyOff(row.employeeId, row.date),
        isHolidayWorked: worked && ctx.holidays.has(ymd(row.date)),
        source: row.leaveConflictSource ?? (row.leaveDayKind === 'HALF' ? 'biometric' : row.source),
        remarks: `Restored from leave #${row.leaveApplicationId}`,
      },
      actor
    );
    return status;
  }

  const status = ctx.weeklyOff.isWeeklyOff(row.employeeId, row.date)
    ? 'WeeklyOff'
    : ctx.holidays.has(ymd(row.date))
      ? 'Holiday'
      : 'Absent';
  await upsertDailyAttendanceWithHistory(
    db,
    row.employeeId,
    row.date,
    {
      ...cleared,
      status,
      inTime: null,
      outTime: null,
      workingMinutes: 0,
      lateMinutes: 0,
      earlyOutMinutes: 0,
      otMinutesCalculated: 0,
      source: 'manual',
      remarks: `Restored from leave #${row.leaveApplicationId}`,
    },
    actor
  );
  return status;
}

/**
 * After a date leaves an unpaid leave (resolve "present"), a weekly off that
 * was LOP only because it sat between two leave days may no longer be
 * sandwiched. Restore any such SANDWICH row to its weekly-off / holiday
 * status. Returns the dates restored.
 */
export async function unsandwich(db: Db, leaveApplicationId: number, ctx: RestoreContext): Promise<Date[]> {
  const rows = await db.dailyAttendance.findMany({
    where: { leaveApplicationId },
    orderBy: { date: 'asc' },
  });
  const leaveKeys = rows.filter((r) => r.leaveDayKind === 'LEAVE').map((r) => r.date.getTime());
  const restored: Date[] = [];
  for (const row of rows) {
    if (row.leaveDayKind !== 'SANDWICH') continue;
    const t = row.date.getTime();
    const before = leaveKeys.some((k) => k < t);
    const after = leaveKeys.some((k) => k > t);
    if (before && after) continue;
    await restoreLeaveDay(db, row, ctx);
    restored.push(row.date);
  }
  return restored;
}
