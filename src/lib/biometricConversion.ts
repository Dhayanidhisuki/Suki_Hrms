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
import { checkMonthNotFrozen, getAttendanceLock } from './attendanceFreeze';
import { upsertDailyAttendanceWithHistory, isProtectedFromDeviceOverwrite, recordLeaveConflict } from './attendanceHistory';
import { notifyLeaveConflict, type LeaveConflictNotice } from './ess/notifyRequest';
import { isWeeklyOffForEmployee, isHolidayOrYearlyLeave } from './weeklyOff';
import type { BiometricAttendanceImport } from '@prisma/client';
import { getFreeHoursPerMonthForEmployee } from './permissionPolicy';
import { appMergeEnabled, recordSourceContribution, reconcileAttendanceDay } from './attendanceMerge';

const HALF_DAY_THRESHOLD_HOURS = 7; // documented guess — see plan; only used when no in/out punch exists
const FALLBACK_STANDARD_SHIFT_MINUTES = 8 * 60; // used only when the employee has no shift assigned at all

interface ShiftInfo {
  id: number;
  startMinutes: number; // minutes since midnight
  endMinutes: number;   // minutes since midnight (may be < startMinutes for overnight shifts)
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
  endMinutes: number | null;
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
    endMinutes: end,
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
  const flatFallback: DailyShift = { shiftMasterId: null, startMinutes: null, endMinutes: null, standardMinutes: FALLBACK_STANDARD_SHIFT_MINUTES, graceMinutes: 0 };

  if (config.assignmentType === 'ROTATIONAL' && config.rotationSlots && config.rotationAnchorDate) {
    const msSinceAnchor = date.getTime() - config.rotationAnchorDate.getTime();
    const weeksSinceAnchor = Math.floor(msSinceAnchor / (7 * 24 * 60 * 60 * 1000));
    const slotCount = config.rotationSlots.length;
    const slotIndex = ((weeksSinceAnchor % slotCount) + slotCount) % slotCount; // proper modulo for dates before the anchor too
    const shift = config.rotationSlots[slotIndex];
    return { shiftMasterId: shift.id, startMinutes: shift.startMinutes, endMinutes: shift.endMinutes, standardMinutes: shift.standardMinutes, graceMinutes: shift.graceMinutes };
  }

  if (config.generalShift) {
    const shift = config.generalShift;
    return { shiftMasterId: shift.id, startMinutes: shift.startMinutes, endMinutes: shift.endMinutes, standardMinutes: shift.standardMinutes, graceMinutes: shift.graceMinutes };
  }

  return flatFallback;
}

/**
 * Phase TimeOffice — resolve the shift for a specific employee/date,
 * checking manual overrides first, then falling back to the rotation plan.
 * Returns the override shift if one exists for this date, otherwise the
 * automatic rotation/general shift.
 */
export async function resolveDailyShiftWithOverride(
  employeeId: number,
  date: Date,
  config: EmployeeShiftConfig
): Promise<DailyShift> {
  // Check for a manual override on this date.
  const override = await prisma.shiftAssignmentOverride.findUnique({
    where: { employeeId_date: { employeeId, date } },
    include: { shiftMaster: true },
  });
  if (override) {
    const shift = toShiftInfo(override.shiftMaster);
    return { shiftMasterId: shift.id, startMinutes: shift.startMinutes, endMinutes: shift.endMinutes, standardMinutes: shift.standardMinutes, graceMinutes: shift.graceMinutes };
  }
  return resolveDailyShift(config, date);
}

export interface ConversionResult {
  converted: number;
  skippedFrozen: number;
  /** Days left alone because a person had already corrected / approved them — see isProtectedFromDeviceOverwrite. */
  skippedProtected: number;
  unmatchedTimes: number;
  /** Punches recorded as conflicts on approved leave days (HR queue). */
  conflicts: LeaveConflictNotice[];
  /** App-merge mode only — protected days the merge held for human review. */
  needsReview?: number;
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
export function parseHHMM(raw: unknown): { hour: number; minute: number } | null {
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

// Phase TimeOffice — early check-in snap buffer. If an employee checks in
// within this many minutes BEFORE the shift start, the inTime is normalized
// (snapped) to the shift start. This prevents treating reasonable early
// arrival as excessive early attendance. 120 minutes = 2 hours.
const EARLY_CHECKIN_SNAP_MINUTES = 120;

export function deriveStatusAndMinutes(
  hours: number | null,
  inTime: Date | null,
  outTime: Date | null,
  shift: DailyShift,
  otThresholdMinutes: number,
  maxOtMinutesPerDay: number | null
): { status: 'Present' | 'HalfDay' | 'Absent'; workingMinutes: number; otMinutes: number; lateMinutes: number; earlyOutMinutes: number; snappedInTime: Date | null } {
  if (inTime && outTime) {
    // ── Early check-in snapping ──────────────────────────────────────
    // If the employee checks in within EARLY_CHECKIN_SNAP_MINUTES before
    // the shift start, normalize the inTime to the shift start time.
    // This prevents treating reasonable early arrival as excessive early
    // attendance and avoids inflating working minutes / OT.
    let effectiveInTime = inTime;
    if (shift.startMinutes !== null) {
      const inTimeOfDay = inTime.getUTCHours() * 60 + inTime.getUTCMinutes();
      const minutesBeforeShift = shift.startMinutes - inTimeOfDay;
      if (minutesBeforeShift > 0 && minutesBeforeShift <= EARLY_CHECKIN_SNAP_MINUTES) {
        // Snap inTime to shift start
        const snapped = new Date(inTime);
        snapped.setUTCHours(Math.floor(shift.startMinutes / 60), shift.startMinutes % 60, 0, 0);
        effectiveInTime = snapped;
      }
    }

    let minutes = Math.round((outTime.getTime() - effectiveInTime.getTime()) / 60000);
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

    // Late = RAW punch-in time of day minus shift start — only computable
    // when a real shift is assigned; the flat 8-hour fallback has no
    // defined start time to be late against. Grace is deliberately NOT
    // subtracted here: every consumer (computeLomMinutes on the attendance
    // screens, the LOM approval routes, payroll's fallback) applies the
    // shift grace itself, and computeAttendanceMetrics (manual entry)
    // stores raw late too. Pre-graced storage double-applied it.
    let lateMinutes = 0;
    if (shift.startMinutes !== null) {
      const inTimeOfDay = effectiveInTime.getUTCHours() * 60 + effectiveInTime.getUTCMinutes();
      lateMinutes = Math.max(0, inTimeOfDay - shift.startMinutes);
    }

    // ── Early checkout calculation ────────────────────────────────────
    // Early-out = shift end minus punch-out time of day — only when the
    // employee leaves BEFORE the shift end. For overnight shifts where
    // endMinutes < startMinutes, the end is on the next day.
    let earlyOutMinutes = 0;
    if (shift.endMinutes !== null) {
      const outTimeOfDay = outTime.getUTCHours() * 60 + outTime.getUTCMinutes();
      if (shift.endMinutes > shift.startMinutes!) {
        // Same-day shift (e.g. 09:00-17:30)
        earlyOutMinutes = Math.max(0, shift.endMinutes - outTimeOfDay);
      } else {
        // Overnight shift (e.g. 22:00-06:00) — end is next morning
        // If outTime is after midnight and before endMinutes, it's early
        if (outTimeOfDay < shift.endMinutes) {
          earlyOutMinutes = Math.max(0, shift.endMinutes - outTimeOfDay);
        } else if (outTimeOfDay > shift.startMinutes!) {
          // Out before midnight — left very early, count from shift end
          earlyOutMinutes = Math.max(0, shift.endMinutes + (24 * 60 - outTimeOfDay));
        }
      }
    }

    return {
      status: minutes >= HALF_DAY_THRESHOLD_HOURS * 60 ? 'Present' : minutes > 0 ? 'HalfDay' : 'Absent',
      workingMinutes,
      otMinutes,
      lateMinutes,
      earlyOutMinutes,
      snappedInTime: effectiveInTime !== inTime ? effectiveInTime : null,
    };
  }
  const h = hours ?? 0;
  return {
    status: h >= HALF_DAY_THRESHOLD_HOURS ? 'Present' : h > 0 ? 'HalfDay' : 'Absent',
    workingMinutes: Math.round(h * 60),
    otMinutes: 0,
    lateMinutes: 0,
    earlyOutMinutes: 0,
    snappedInTime: null,
  };
}

export async function convertImportToDailyAttendance(
  importId: number,
  triggeredByUserId?: number | null
): Promise<ConversionResult> {
  const row = await prisma.biometricAttendanceImport.findUniqueOrThrow({ where: { id: importId } });

  const result: ConversionResult = { converted: 0, skippedFrozen: 0, skippedProtected: 0, unmatchedTimes: 0, conflicts: [] };
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

    // A day a person already decided (manual entry, mispunch / leave /
    // on-duty / WFH approval) must not be undone by device data — a device
    // import is a fresh reading of the same punches, not a correction of a
    // correction. A MANUAL file upload is itself a human act and may still
    // overwrite; only status Leave / OnDuty is protected from it.
    const incomingSource = row.fromWhere === 'BIOMETRIC' ? 'biometric' : 'manual';
    const existingRow = await prisma.dailyAttendance.findUnique({
      where: { employeeId_date: { employeeId, date } },
      select: { id: true, source: true, status: true, leaveApplicationId: true, leaveDayKind: true, leaveConflictInTime: true, leaveConflictOutTime: true },
    });
    const isHalfDayLeave = existingRow?.leaveApplicationId != null && existingRow.leaveDayKind === 'HALF';

    const parsedIn = parseHHMM(inRaw);
    const parsedOut = parseHHMM(outRaw);

    if (existingRow && !isHalfDayLeave && isProtectedFromDeviceOverwrite(existingRow, incomingSource)) {
      result.skippedProtected++;
      // A punch on an approved full leave day is a conflict for HR to
      // decide (leave core 2026-09-25), never applied silently.
      if (existingRow.leaveApplicationId != null && (parsedIn || parsedOut)) {
        const recorded = await recordLeaveConflict(prisma, existingRow, {
          inTime: parsedIn ? combineDateAndTime(date, parsedIn) : null,
          outTime: parsedOut ? combineDateAndTime(date, parsedOut) : null,
          source: incomingSource,
        });
        if (recorded) result.conflicts.push({ employeeId, date, leaveApplicationId: existingRow.leaveApplicationId });
      }
      continue;
    }
    if ((inRaw !== null && inRaw !== undefined && Number(inRaw) > 0 && !parsedIn) ||
        (outRaw !== null && outRaw !== undefined && Number(outRaw) > 0 && !parsedOut)) {
      result.unmatchedTimes++;
    }

    const inTime = parsedIn ? combineDateAndTime(date, parsedIn) : null;
    const outTime = parsedOut ? combineDateAndTime(date, parsedOut) : null;

    if (appMergeEnabled()) {
      // Merged mode: this import is just one source feeding the shared
      // merge — record its contribution and let reconcileAttendanceDay
      // decide the final row (with the locked-month, manual-correction and
      // decided-approval protections enforced inside the merge).
      await recordSourceContribution(prisma, employeeId, date, 'biometric', {
        inTime,
        outTime,
        hours,
        sourceRowId: `import:${importId}:day${d}`,
      });
      const outcome = await reconcileAttendanceDay(prisma, employeeId, date, {
        companyId: row.companyId,
        userId: triggeredByUserId ?? null,
        shiftConfig,
      });
      if (outcome === 'skipped_locked_month') result.skippedFrozen++;
      else if (outcome === 'needs_review') result.needsReview = (result.needsReview ?? 0) + 1;
      else result.converted++;
      touchedMonths.add(`${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`);
      continue;
    }

    const dailyShift = await resolveDailyShiftWithOverride(employeeId, date, shiftConfig);
    const { status, workingMinutes, otMinutes, lateMinutes, earlyOutMinutes, snappedInTime } = deriveStatusAndMinutes(
      hours, inTime, outTime, dailyShift, shiftConfig.otThresholdMinutes, shiftConfig.maxOtMinutesPerDay
    );

    // Use snapped inTime if early check-in was normalized
    const effectiveInTime = snappedInTime ?? inTime;

    if (isHalfDayLeave) {
      // Half-day leave: the worked half's punches merge into the day; it
      // stays HalfDay and never queues OT or LOM (the other half is leave).
      await upsertDailyAttendanceWithHistory(
        prisma,
        employeeId,
        date,
        { inTime: effectiveInTime, outTime, workingMinutes, shiftMasterId: dailyShift.shiftMasterId, otMinutesCalculated: 0, lateMinutes: 0, earlyOutMinutes: 0 },
        { userId: triggeredByUserId ?? null, changedBySource: 'biometric' }
      );
      result.converted++;
      touchedMonths.add(`${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`);
      continue;
    }

    // ── Auto-detect weekly-off/holiday worked ──────────────────────
    // If the employee has at least one punch on a day that is their
    // weekly off or a declared holiday/yearly leave, and the day is not
    // Absent, mark the flags so OT approval can offer comp-off settlement.
    // Gated on "any punch", not "both punches": a Sunday worked with a
    // missing OUT punch must still be offered comp-off. companyId comes
    // from the import row — no per-day employee lookup needed.
    let isWeeklyOffWorked = false;
    let isHolidayWorked = false;
    if ((inTime || outTime) && status !== 'Absent') {
      isWeeklyOffWorked = await isWeeklyOffForEmployee(row.companyId, employeeId, date);
      isHolidayWorked = await isHolidayOrYearlyLeave(row.companyId, date);
    }

    // Goes through the history-recording helper, never a bare upsert — an
    // import must never silently destroy a day someone already corrected;
    // the superseded values are snapshotted into DailyAttendanceHistory.
    await upsertDailyAttendanceWithHistory(
      prisma,
      employeeId,
      date,
      {
        status,
        inTime: effectiveInTime,
        outTime,
        workingMinutes,
        otMinutesCalculated: otMinutes,
        lateMinutes,
        earlyOutMinutes,
        source: row.fromWhere === 'BIOMETRIC' ? 'biometric' : 'manual',
        shiftMasterId: dailyShift.shiftMasterId,
        isWeeklyOffWorked: isWeeklyOffWorked || undefined,
        isHolidayWorked: isHolidayWorked || undefined,
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

  for (const c of result.conflicts) await notifyLeaveConflict(row.companyId, c);

  return result;
}

/**
 * Recomputes MonthlyAttendanceSummary's count fields for one employee/month
 * from its current DailyAttendance rows — same aggregation the manual
 * Finalize action uses, but never touches `status` (only Finalize/Freeze do).
 *
 * Refuses a locked month (FROZEN / READY_FOR_PAYROLL / payroll processed):
 * every approval and reject route calls this after writing, and until
 * 2026-09-25 a frozen month's counts could still drift through it. Returns
 * false when it skipped, true when it wrote.
 */
export async function refreshMonthlySummary(employeeId: number, year: number, month: number): Promise<boolean> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const lock = await getAttendanceLock(employeeId, monthStart);
  if (lock) {
    console.warn(`[refreshMonthlySummary] skipped employee ${employeeId} ${year}-${month}: ${lock.reason}`);
    return false;
  }

  const days = await prisma.dailyAttendance.findMany({
    where: { employeeId, date: { gte: monthStart, lt: monthEnd } },
  });

  // Permission excess → LOP: approved PermissionRequests with excessHours
  // beyond the company's free allowance are converted to LOP days. The
  // PermissionPolicy.freeHoursPerMonth defines the free quota; any excess
  // hours above that are converted to LOP days at 8 hours = 1 day.
  const freeHoursPerMonth = await getFreeHoursPerMonthForEmployee(employeeId);

  const permissionRequests = await prisma.permissionRequest.findMany({
    where: {
      employeeId,
      date: { gte: monthStart, lt: monthEnd },
      status: 'approved',
      exceedsAllowance: true,
    },
  });

  // Sum all approved permission hours for the month, then subtract the free
  // allowance to get excess hours. Convert excess to LOP days (8 hrs = 1 day).
  const totalPermissionHours = permissionRequests.reduce(
    (sum, p) => sum + Number(p.hours), 0
  );
  const excessHours = Math.max(0, totalPermissionHours - freeHoursPerMonth);
  const permissionLopDays = excessHours / 8; // 8 hours = 1 LOP day

  // Leave core (2026-09-25): rows written by a leave approval carry the
  // application; its type decides whether a half day's other half is paid
  // leave or LOP, and which per-type column the day counts in.
  const linkedAppIds = Array.from(new Set(days.map((d) => d.leaveApplicationId).filter((id): id is number => id != null)));
  const linkedApps = linkedAppIds.length
    ? await prisma.leaveApplication.findMany({
        where: { id: { in: linkedAppIds } },
        select: { id: true, leaveMaster: { select: { code: true, isPaid: true } } },
      })
    : [];
  const typeByAppId = new Map(linkedApps.map((a) => [a.id, a.leaveMaster]));

  let presentDays = 0;
  let absentDays = 0;
  let leaveDays = 0;
  let lopDays = 0;
  let halfDays = 0; // unlinked half days only — half absent, half present
  let weeklyOffDays = 0;
  let holidayDays = 0;
  let otMinutesApprovedTotal = 0;
  let lateMinutesTotal = 0;
  let earlyOutMinutesTotal = 0;
  let holidayWorkedDays = 0;
  let elDays = 0, clDays = 0, slDays = 0, mlDays = 0, plDays = 0, compOffDays = 0, otherLeaveDays = 0;

  const countLeaveType = (code: string, n: number) => {
    if (code === 'EL') elDays += n;
    else if (code === 'CL') clDays += n;
    else if (code === 'SL') slDays += n;
    else if (code === 'ML') mlDays += n;
    else if (code === 'PL') plDays += n;
    else if (code === 'COMPOFF' || code === 'CO' || code === 'COMP_OFF') compOffDays += n;
    else otherLeaveDays += n;
  };

  for (const d of days) {
    const leaveType = d.leaveApplicationId != null ? typeByAppId.get(d.leaveApplicationId) : undefined;
    if (d.status === 'Present' || d.status === 'OnDuty') {
      presentDays += 1;
    } else if (d.status === 'HalfDay' && leaveType) {
      // Half-day leave: half worked, half leave (paid) or half LOP (unpaid).
      presentDays += 0.5;
      if (leaveType.isPaid) {
        leaveDays += 0.5;
        countLeaveType(leaveType.code, 0.5);
      } else {
        lopDays += 0.5;
      }
    } else if (d.status === 'HalfDay') {
      presentDays += 0.5;
      halfDays += 1;
    } else if (d.status === 'Absent' || d.status === 'MissingPunch') {
      absentDays += 1;
    } else if (d.status === 'Leave') {
      leaveDays += 1;
      if (leaveType) countLeaveType(leaveType.code, 1);
    } else if (d.status === 'LOP') {
      lopDays += 1;
    } else if (d.status === 'WeeklyOff') {
      weeklyOffDays += 1;
    } else if (d.status === 'Holiday') {
      holidayDays += 1;
    }

    // Phase 12 — count holiday/weekly-off worked days.
    if (d.isHolidayWorked) holidayWorkedDays += 1;

    // otMinutesTotal is the total calculated overtime for the month; payroll
    // will later apply the OTPlan threshold, caps and approval status.
    if (['Present', 'HalfDay', 'OnDuty'].includes(d.status)) {
      otMinutesApprovedTotal += d.otMinutesCalculated ?? 0;
    }
    lateMinutesTotal += d.lateMinutes;
    earlyOutMinutesTotal += d.earlyOutMinutes;
  }

  // Legacy leaves (approved before the day rows carried a link, and not
  // backfilled because two applications covered one date): prorate the
  // application span by calendar days, as before, ONLY when none of its
  // rows in this month are linked.
  const leaveApps = await prisma.leaveApplication.findMany({
    where: {
      employeeId,
      status: 'approved',
      fromDate: { lt: monthEnd },
      toDate: { gte: monthStart },
      id: { notIn: linkedAppIds },
    },
    include: { leaveMaster: { select: { code: true } } },
  });
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0));
  for (const app of leaveApps) {
    const from = app.fromDate < monthStart ? monthStart : app.fromDate;
    const to = app.toDate > lastDayOfMonth ? lastDayOfMonth : app.toDate;
    const daysInThisMonth = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    countLeaveType(app.leaveMaster?.code ?? '', app.isHalfDay ? 0.5 : daysInThisMonth);
  }

  const totalCalendarDays = daysInMonth(year, month);
  const totalAbsentDays = absentDays + halfDays * 0.5;
  // Add permission excess LOP days to the total LOP count.
  const totalLopDays = lopDays + permissionLopDays;
  const payableDays = Math.max(0, totalCalendarDays - totalAbsentDays - totalLopDays);

  const counts = {
    totalWorkingDays: totalCalendarDays,
    payableDays,
    presentDays,
    absentDays: totalAbsentDays,
    leaveDays,
    lopDays: totalLopDays,
    otMinutesTotal: otMinutesApprovedTotal,
    lateMinutesTotal,
    earlyOutMinutesTotal,
    elDays,
    clDays,
    slDays,
    mlDays,
    plDays,
    compOffDays,
    otherLeaveDays,
    holidayWorkedDays,
    permissionHours: totalPermissionHours,
    permissionExcessHours: excessHours,
  };

  await prisma.monthlyAttendanceSummary.upsert({
    where: { employeeId_year_month: { employeeId, year, month } },
    update: counts,
    create: { employeeId, year, month, ...counts },
  });
  return true;
}

export type { BiometricAttendanceImport };
