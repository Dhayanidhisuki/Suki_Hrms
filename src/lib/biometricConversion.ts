/**
 * Converts one BiometricAttendanceImport row (a whole wage period for one
 * matched employee) into DailyAttendance rows + refreshed
 * MonthlyAttendanceSummary counts.
 *
 * Per day: prefer the real day{N}InTime/day{N}OutTime punch times (parsed
 * from the source's raw HH.MM encoding) to set DailyAttendance.inTime/
 * outTime and derive status from the actual worked duration — this also
 * computes workingMinutes and otMinutesCalculated from that real punch pair,
 * the same as any other biometric ingestion path (bulk upload or a live
 * device push both funnel through here, so neither is a special case).
 * Falls back to the hours-only guessed threshold (see below) only when a
 * day has an hours value but no usable in/out punch — OT is never guessed
 * from that fallback, only from a real punch pair.
 *
 * The "standard day" length, late-minutes rule, and OT rule are pulled from
 * the company's own admin-managed masters, not hardcoded:
 *
 * - ShiftMaster (Masters > Shift Masters — startTime/endTime/graceMinutes)
 *   supplies the standard shift length and the grace period before a late
 *   punch-in counts as late at all.
 * - JobInfo.shiftAssignmentType decides which shift applies on a given day:
 *   GENERAL uses the single JobInfo.shiftMasterId every day; ROTATIONAL
 *   uses JobInfo.shiftRotationPlanId instead — the actual shift cycles
 *   week to week through that plan's ordered ShiftRotationSlots, anchored
 *   to a real calendar date (see resolveDailyShift) — e.g. a 3-slot plan
 *   gives week 1 = slot 0, week 2 = slot 1, week 3 = slot 2, week 4 = slot
 *   0 again.
 * - OTPlan (Masters > OT Plans — applicableAfterMinutes is how many
 *   minutes past the standard shift length must be worked before it counts
 *   as OT at all, maxOtHoursPerDay is an optional daily cap) via the first
 *   active plan.
 *
 * All of this is genuinely optional: an employee with no shift assigned
 * falls back to a flat 8-hour day and no late-minutes calculation
 * (documented default, see resolveEmployeeShiftConfig), and with no active
 * OTPlan configured, any excess over the standard day counts as OT with no
 * minimum-to-qualify gate. Every one of these takes effect immediately the
 * moment an admin sets it up in the relevant master — no code change.
 *
 * Respects the existing frozen-month guard (checkMonthNotFrozen) exactly
 * like the manual Daily Attendance route does — a day landing in an
 * already-FROZEN month is skipped and reported, never overwritten. Status
 * itself is never changed here; only the manual Finalize/Freeze actions
 * change MonthlyAttendanceSummary.status.
 */

import { prisma } from './prisma';
import { checkMonthNotFrozen } from './attendanceFreeze';
import { upsertDailyAttendanceWithHistory } from './attendanceHistory';
import type { BiometricAttendanceImport } from '@prisma/client';

const HALF_DAY_THRESHOLD_HOURS = 7; // documented guess — see plan; only used when no in/out punch exists
const FALLBACK_STANDARD_SHIFT_MINUTES = 8 * 60; // used only when the employee has no shift assigned at all

interface ShiftInfo {
  id: number;
  startMinutes: number; // minutes since midnight
  standardMinutes: number; // shift duration, overnight-aware
  graceMinutes: number;
}

/** The employee's shift configuration, resolved once per import row and reused across all 31 days (cheap — no DB call per day). */
export interface EmployeeShiftConfig {
  assignmentType: 'GENERAL' | 'ROTATIONAL';
  generalShift: ShiftInfo | null; // set when assignmentType === 'GENERAL'
  rotationSlots: ShiftInfo[] | null; // ordered cycle, set when assignmentType === 'ROTATIONAL'
  rotationAnchorDate: Date | null;
  otThresholdMinutes: number;
  maxOtMinutesPerDay: number | null;
}

/** One day's resolved shift — either a fixed shift, the rotation's slot for that calendar week, or none at all (flat fallback). */
export interface DailyShift {
  shiftMasterId: number | null;
  startMinutes: number | null;
  standardMinutes: number;
  graceMinutes: number;
}

/** "HH:mm" -> minutes since midnight. */
function timeStringToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function toShiftInfo(shift: { id: number; startTime: string; endTime: string; graceMinutes: number }): ShiftInfo {
  const start = timeStringToMinutes(shift.startTime);
  const end = timeStringToMinutes(shift.endTime);
  return {
    id: shift.id,
    startMinutes: start,
    standardMinutes: end > start ? end - start : 24 * 60 - start + end, // overnight shift, e.g. 22:00-06:00
    graceMinutes: shift.graceMinutes,
  };
}

/**
 * Resolves the employee's shift configuration and the active OT rule, from
 * the admin-managed ShiftMaster/ShiftRotationPlan/OTPlan masters — see this
 * file's top comment. Looked up once per convertImportToDailyAttendance
 * call; resolveDailyShift then picks the specific day's shift in memory.
 */
export async function resolveEmployeeShiftConfig(employeeId: number): Promise<EmployeeShiftConfig> {
  const jobInfo = await prisma.jobInfo.findFirst({
    where: { employeeId, effectiveTo: null },
    select: { shiftAssignmentType: true, shiftMasterId: true, shiftRotationPlanId: true },
  });

  const otPlan = await prisma.oTPlan.findFirst({
    where: { isActive: true, deletedAt: null },
    orderBy: { id: 'asc' },
    select: { applicableAfterMinutes: true, maxOtHoursPerDay: true },
  });
  const otThresholdMinutes = otPlan?.applicableAfterMinutes ?? 0;
  const maxOtMinutesPerDay = otPlan?.maxOtHoursPerDay ? otPlan.maxOtHoursPerDay * 60 : null;

  if (jobInfo?.shiftAssignmentType === 'ROTATIONAL' && jobInfo.shiftRotationPlanId) {
    const plan = await prisma.shiftRotationPlan.findUnique({
      where: { id: jobInfo.shiftRotationPlanId },
      include: { slots: { orderBy: { sequenceOrder: 'asc' }, include: { shiftMaster: true } } },
    });
    if (plan && plan.slots.length > 0) {
      return {
        assignmentType: 'ROTATIONAL',
        generalShift: null,
        rotationSlots: plan.slots.map((s) => toShiftInfo(s.shiftMaster)),
        rotationAnchorDate: plan.anchorDate,
        otThresholdMinutes,
        maxOtMinutesPerDay,
      };
    }
  }

  if (jobInfo?.shiftMasterId) {
    const shift = await prisma.shiftMaster.findUnique({ where: { id: jobInfo.shiftMasterId } });
    if (shift) {
      return {
        assignmentType: 'GENERAL',
        generalShift: toShiftInfo(shift),
        rotationSlots: null,
        rotationAnchorDate: null,
        otThresholdMinutes,
        maxOtMinutesPerDay,
      };
    }
  }

  // No shift assigned at all — flat fallback, no late-minutes calculation possible.
  return {
    assignmentType: 'GENERAL',
    generalShift: null,
    rotationSlots: null,
    rotationAnchorDate: null,
    otThresholdMinutes,
    maxOtMinutesPerDay,
  };
}

/**
 * Picks the shift that applies on one specific calendar date, given the
 * employee's resolved config. For ROTATIONAL, the slot is
 * floor(weeksSinceAnchor) mod slot count — e.g. a 3-slot cycle anchored on
 * a Monday gives that week slot 0, the next week slot 1, the next slot 2,
 * then back to slot 0.
 */
export function resolveDailyShift(config: EmployeeShiftConfig, date: Date): DailyShift {
  const flatFallback: DailyShift = { shiftMasterId: null, startMinutes: null, standardMinutes: FALLBACK_STANDARD_SHIFT_MINUTES, graceMinutes: 0 };

  if (config.assignmentType === 'ROTATIONAL' && config.rotationSlots && config.rotationAnchorDate) {
    const msSinceAnchor = date.getTime() - config.rotationAnchorDate.getTime();
    const weeksSinceAnchor = Math.floor(msSinceAnchor / (7 * 24 * 60 * 60 * 1000));
    const slotCount = config.rotationSlots.length;
    const slotIndex = ((weeksSinceAnchor % slotCount) + slotCount) % slotCount; // proper modulo for dates before the anchor too
    const shift = config.rotationSlots[slotIndex];
    return { shiftMasterId: shift.id, startMinutes: shift.startMinutes, standardMinutes: shift.standardMinutes, graceMinutes: shift.graceMinutes };
  }

  if (config.generalShift) {
    const shift = config.generalShift;
    return { shiftMasterId: shift.id, startMinutes: shift.startMinutes, standardMinutes: shift.standardMinutes, graceMinutes: shift.graceMinutes };
  }

  return flatFallback;
}

export interface ConversionResult {
  converted: number;
  skippedFrozen: number;
  unmatchedTimes: number;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * "HH.MM" decimal → {hour, minute}, or null if it's not a punch (0/absent)
 * or doesn't parse as a valid time. 0 is the source's convention for
 * "no punch that day", not midnight — confirmed by day1 always being 0
 * across all three source tables (a non-working anchor day).
 */
function parseHHMM(raw: unknown): { hour: number; minute: number } | null {
  if (raw === null || raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;

  const hour = Math.floor(value);
  // Source encodes minutes as the two decimal digits (18.43 = 18:43), not a
  // true decimal fraction of an hour — round to avoid float noise (e.g.
  // 9.1 stored as 9.099999...).
  const minute = Math.round((value - hour) * 100);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function combineDateAndTime(date: Date, time: { hour: number; minute: number }): Date {
  const d = new Date(date);
  d.setUTCHours(time.hour, time.minute, 0, 0);
  return d;
}

export function deriveStatusAndMinutes(
  hours: number | null,
  inTime: Date | null,
  outTime: Date | null,
  shift: DailyShift,
  otThresholdMinutes: number,
  maxOtMinutesPerDay: number | null
): { status: 'Present' | 'HalfDay' | 'Absent'; workingMinutes: number; otMinutes: number; lateMinutes: number } {
  if (inTime && outTime) {
    let minutes = Math.round((outTime.getTime() - inTime.getTime()) / 60000);
    if (minutes < 0) minutes += 24 * 60; // overnight shift crossing midnight
    const workingMinutes = Math.max(minutes, 0);

    // OT only comes from a real punch pair — a guessed hours-only day isn't
    // a reliable enough basis to bill overtime against. excessMinutes must
    // clear the OTPlan's applicableAfterMinutes gate before ANY of it
    // counts (a minimum-to-qualify threshold, not a deduction), then it's
    // optionally capped at maxOtHoursPerDay.
    const excessMinutes = Math.max(0, workingMinutes - shift.standardMinutes);
    let otMinutes = excessMinutes >= otThresholdMinutes ? excessMinutes : 0;
    if (maxOtMinutesPerDay !== null) otMinutes = Math.min(otMinutes, maxOtMinutesPerDay);

    // Late = punch-in time of day minus (shift start + grace) — only
    // computable when a real shift is assigned; the flat 8-hour fallback
    // has no defined start time to be late against.
    let lateMinutes = 0;
    if (shift.startMinutes !== null) {
      const inTimeOfDay = inTime.getUTCHours() * 60 + inTime.getUTCMinutes();
      lateMinutes = Math.max(0, inTimeOfDay - (shift.startMinutes + shift.graceMinutes));
    }

    return {
      status: minutes >= HALF_DAY_THRESHOLD_HOURS * 60 ? 'Present' : minutes > 0 ? 'HalfDay' : 'Absent',
      workingMinutes,
      otMinutes,
      lateMinutes,
    };
  }
  const h = hours ?? 0;
  return {
    status: h >= HALF_DAY_THRESHOLD_HOURS ? 'Present' : h > 0 ? 'HalfDay' : 'Absent',
    workingMinutes: Math.round(h * 60),
    otMinutes: 0,
    lateMinutes: 0,
  };
}

export async function convertImportToDailyAttendance(
  importId: number,
  triggeredByUserId?: number | null
): Promise<ConversionResult> {
  const row = await prisma.biometricAttendanceImport.findUniqueOrThrow({ where: { id: importId } });

  const result: ConversionResult = { converted: 0, skippedFrozen: 0, unmatchedTimes: 0 };
  if (!row.matchedEmployeeId) return result; // unmatched EMP_ID — nothing to push yet

  const employeeId = row.matchedEmployeeId;
  const touchedMonths = new Set<string>(); // "year-month" keys needing a MonthlyAttendanceSummary refresh
  // Resolved once per row (not per day) — the employee's shift assignment
  // and the active OTPlan don't change day to day within one import. The
  // SPECIFIC shift for a rotational employee still varies day to day
  // though (see resolveDailyShift below), since a 31-day row can span
  // several rotation weeks.
  const shiftConfig = await resolveEmployeeShiftConfig(employeeId);

  for (let d = 1; d <= 31; d++) {
    const hoursRaw = (row as unknown as Record<string, unknown>)[`day${d}`];
    const inRaw = (row as unknown as Record<string, unknown>)[`day${d}InTime`];
    const outRaw = (row as unknown as Record<string, unknown>)[`day${d}OutTime`];

    const hours = hoursRaw === null || hoursRaw === undefined ? null : Number(hoursRaw);
    if (hours === null && inRaw === null && outRaw === null) continue; // no data at all for this day

    const date = new Date(row.periodStartDate);
    date.setUTCDate(date.getUTCDate() + (d - 1));

    const freezeErr = await checkMonthNotFrozen(employeeId, date);
    if (freezeErr) {
      result.skippedFrozen++;
      continue;
    }

    const parsedIn = parseHHMM(inRaw);
    const parsedOut = parseHHMM(outRaw);
    if ((inRaw !== null && inRaw !== undefined && Number(inRaw) > 0 && !parsedIn) ||
        (outRaw !== null && outRaw !== undefined && Number(outRaw) > 0 && !parsedOut)) {
      result.unmatchedTimes++;
    }

    const inTime = parsedIn ? combineDateAndTime(date, parsedIn) : null;
    const outTime = parsedOut ? combineDateAndTime(date, parsedOut) : null;
    const dailyShift = resolveDailyShift(shiftConfig, date);
    const { status, workingMinutes, otMinutes, lateMinutes } = deriveStatusAndMinutes(
      hours, inTime, outTime, dailyShift, shiftConfig.otThresholdMinutes, shiftConfig.maxOtMinutesPerDay
    );

    // Goes through the history-recording helper, never a bare upsert — an
    // import must never silently destroy a day someone already corrected;
    // the superseded values are snapshotted into DailyAttendanceHistory.
    await upsertDailyAttendanceWithHistory(
      prisma,
      employeeId,
      date,
      {
        status,
        inTime,
        outTime,
        workingMinutes,
        otMinutesCalculated: otMinutes,
        lateMinutes,
        source: row.fromWhere === 'BIOMETRIC' ? 'biometric' : 'manual',
        shiftMasterId: dailyShift.shiftMasterId,
      },
      { userId: triggeredByUserId ?? null, changedBySource: 'biometric' }
    );

    result.converted++;
    touchedMonths.add(`${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`);
  }

  await Promise.all(
    Array.from(touchedMonths).map(async (key) => {
      const [yearStr, monthStr] = key.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      await refreshMonthlySummary(employeeId, year, month);
    })
  );

  await prisma.biometricAttendanceImport.update({
    where: { id: importId },
    data: { processedAt: new Date() },
  });

  return result;
}

/**
 * Recomputes MonthlyAttendanceSummary's count fields for one employee/month
 * from its current DailyAttendance rows — same aggregation the manual
 * Finalize action uses, but never touches `status` (only Finalize/Freeze do).
 */
export async function refreshMonthlySummary(employeeId: number, year: number, month: number) {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const days = await prisma.dailyAttendance.findMany({
    where: { employeeId, date: { gte: monthStart, lt: monthEnd } },
  });

  let presentDays = 0;
  let absentDays = 0;
  let leaveDays = 0;
  let lopDays = 0;
  let halfDays = 0;
  let weeklyOffDays = 0;
  let holidayDays = 0;
  let otMinutesApprovedTotal = 0;
  let lateMinutesTotal = 0;
  let earlyOutMinutesTotal = 0;

  for (const d of days) {
    if (d.status === 'Present' || d.status === 'OnDuty') {
      presentDays += 1;
    } else if (d.status === 'HalfDay') {
      presentDays += 0.5;
      halfDays += 1;
    } else if (d.status === 'Absent' || d.status === 'MissingPunch') {
      absentDays += 1;
    } else if (d.status === 'Leave') {
      leaveDays += 1;
    } else if (d.status === 'LOP') {
      lopDays += 1;
    } else if (d.status === 'WeeklyOff') {
      weeklyOffDays += 1;
    } else if (d.status === 'Holiday') {
      holidayDays += 1;
    }

    // Only HR-approved OT with settlementType === 'OT' is paid out in payroll
    if (d.otApprovalStatus === 'approved' && d.otSettlementType === 'OT' && d.otMinutesApproved) {
      otMinutesApprovedTotal += d.otMinutesApproved;
    }
    lateMinutesTotal += d.lateMinutes;
    earlyOutMinutesTotal += d.earlyOutMinutes;
  }

  const totalCalendarDays = daysInMonth(year, month);
  const totalAbsentDays = absentDays + halfDays * 0.5;
  const payableDays = Math.max(0, totalCalendarDays - totalAbsentDays - lopDays);

  const counts = {
    totalWorkingDays: totalCalendarDays,
    payableDays,
    presentDays,
    absentDays: totalAbsentDays,
    leaveDays,
    lopDays,
    otMinutesTotal: otMinutesApprovedTotal,
    lateMinutesTotal,
    earlyOutMinutesTotal,
  };

  await prisma.monthlyAttendanceSummary.upsert({
    where: { employeeId_year_month: { employeeId, year, month } },
    update: counts,
    create: { employeeId, year, month, ...counts },
  });
}

export type { BiometricAttendanceImport };
