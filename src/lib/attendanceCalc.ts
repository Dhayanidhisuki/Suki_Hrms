/**
 * Shared attendance calculation helpers.
 *
 * Used by both the API layer (to compute and persist derived fields) and the
 * UI layer (to display LOM after shift grace and OT after the configured
 * threshold), so the numbers shown on screen always match what payroll uses.
 */

export interface ShiftMasterLite {
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  graceMinutes: number;
  nightAllowed?: boolean;
}

export interface OtPlanLite {
  applicableAfterMinutes: number;
  maxOtHoursPerDay?: number | null;
}

export interface LomConfigLite {
  graceMinutesExempt: number;
  dailyLomCap?: number | null;
}

/**
 * Parse "HH:mm" into minutes from midnight.
 */
export function parseShiftTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Returns true if the shift end time is earlier than or equal to the start
 * time, meaning the shift crosses midnight (e.g. 22:00 -> 06:00).
 */
export function shiftCrossesMidnight(shift: ShiftMasterLite): boolean {
  const start = parseShiftTime(shift.startTime);
  const end = parseShiftTime(shift.endTime);
  return end <= start;
}

/**
 * Given an ISO in-time, out-time, and the assigned shift master, compute the
 * raw attendance metrics: late minutes, early-out minutes, working minutes,
 * and raw OT minutes (before the OT plan threshold is applied).
 *
 * Handles cross-midnight shifts (night shift 22:00 -> 06:00) where the out
 * punch falls on the next calendar day.
 */
export function computeAttendanceMetrics(
  inTime: Date | string | null,
  outTime: Date | string | null,
  shift: ShiftMasterLite | null
): {
  lateMinutes: number;
  earlyOutMinutes: number;
  workingMinutes: number;
  otMinutesCalculated: number;
} {
  if (!inTime || !outTime || !shift) {
    return { lateMinutes: 0, earlyOutMinutes: 0, workingMinutes: 0, otMinutesCalculated: 0 };
  }

  const inDate = new Date(inTime);
  const outDate = new Date(outTime);

  const inMin = inDate.getUTCHours() * 60 + inDate.getUTCMinutes();
  let outMin = outDate.getUTCHours() * 60 + outDate.getUTCMinutes();

  const shiftStart = parseShiftTime(shift.startTime);
  const shiftEndRaw = parseShiftTime(shift.endTime);
  const crosses = shiftCrossesMidnight(shift);
  const shiftEnd = crosses ? shiftEndRaw + 24 * 60 : shiftEndRaw;

  // If out is on a different calendar day than in, add 24h
  const inDay = inDate.toISOString().slice(0, 10);
  const outDay = outDate.toISOString().slice(0, 10);
  if (inDay !== outDay) {
    outMin += 24 * 60;
  }

  const lateMinutes = Math.max(0, inMin - shiftStart);
  const workingMinutes = outMin - inMin;

  let earlyOutMinutes = 0;
  let otMinutesCalculated = 0;

  if (outMin < shiftEnd) {
    earlyOutMinutes = shiftEnd - outMin;
  } else if (outMin > shiftEnd) {
    otMinutesCalculated = outMin - shiftEnd;
  }

  return { lateMinutes, earlyOutMinutes, workingMinutes: Math.max(0, workingMinutes), otMinutesCalculated };
}

/**
 * Compute LOM minutes for a single attendance day, using the shift master's
 * grace minutes (preferred) and falling back to the company-level LOM config
 * grace. Applies the daily LOM cap if configured.
 *
 *   lateAfterGrace = max(0, lateMinutes - shiftGrace)
 *   rawLom = lateAfterGrace + earlyOutMinutes
 *   lomCapped = dailyCap > 0 ? min(rawLom, dailyCap) : rawLom
 *
 * Important: grace is applied to late minutes only, not early-out minutes.
 */
export function computeLomMinutes(
  lateMinutes: number,
  earlyOutMinutes: number,
  shift: ShiftMasterLite | null,
  lomConfig: LomConfigLite | null
): number {
  const shiftGrace = shift?.graceMinutes ?? lomConfig?.graceMinutesExempt ?? 0;
  const lateAfterGrace = Math.max(0, (lateMinutes || 0) - shiftGrace);
  let lom = lateAfterGrace + (earlyOutMinutes || 0);
  const cap = lomConfig?.dailyLomCap;
  if (cap && cap > 0 && lom > cap) lom = cap;
  return lom;
}

/**
 * Compute payable OT minutes for a single attendance day, applying the OT
 * plan's threshold as a qualification condition and the daily cap.
 *
 *   if otMinutesCalculated < applicableAfterMinutes:
 *     payable = 0
 *   else:
 *     payable = min(otMinutesCalculated, maxDailyCapMinutes)
 */
export function computeOtPayableMinutes(
  otMinutesCalculated: number,
  otPlan: OtPlanLite | null
): number {
  const threshold = otPlan?.applicableAfterMinutes ?? 0;
  if ((otMinutesCalculated || 0) < threshold) return 0;
  const capMin = otPlan?.maxOtHoursPerDay ? otPlan.maxOtHoursPerDay * 60 : 0;
  if (capMin > 0) return Math.min(otMinutesCalculated || 0, capMin);
  return otMinutesCalculated || 0;
}
