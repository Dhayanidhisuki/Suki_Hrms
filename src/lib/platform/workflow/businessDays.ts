/**
 * Business-day arithmetic for SLA timers (BRD §9.2).
 *
 * A business day is a calendar day that is neither a weekly off for the
 * approver whose calendar governs nor a company holiday / yearly-leave
 * calendar day. Weekly offs come from buildWeeklyOffResolver (department
 * configuration, Sunday fallback); holidays from isHolidayOrYearlyLeave.
 *
 * Fractional days: escalationDays is Decimal(4,1) and URGENT halves it, so
 * 0.5 / 1.5 are common. The whole part steps forward whole business days;
 * the fractional part is applied as wall-clock hours (fraction × 24h) on the
 * business day the whole part landed on, rolling to the same time on the
 * next business day if that lands on a non-business day.
 *
 * The pure *WithCalendar variants take an injected calendar so the rules
 * can be unit-tested without a database.
 */

import { buildWeeklyOffResolver, isHolidayOrYearlyLeave } from '@/lib/weeklyOff';

const DAY_MS = 24 * 60 * 60 * 1000;

export type BusinessCalendar = {
  /** `date` is any instant; the calendar decides on its UTC calendar day. */
  isBusinessDay(date: Date): boolean | Promise<boolean>;
};

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function roundTo(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

export async function addBusinessDaysWithCalendar(from: Date, days: number, calendar: BusinessCalendar): Promise<Date> {
  if (!Number.isFinite(days) || days <= 0) return new Date(from.getTime());
  const whole = Math.floor(days);
  const fraction = roundTo(days - whole, 4);

  let cursor = new Date(from.getTime());
  let counted = 0;
  let guard = 0;
  while (counted < whole) {
    cursor = new Date(cursor.getTime() + DAY_MS);
    if (await calendar.isBusinessDay(cursor)) counted++;
    if (++guard > 3660) throw new Error('addBusinessDays: no business day found within 10 years');
  }

  if (fraction > 0) {
    cursor = new Date(cursor.getTime() + Math.round(fraction * DAY_MS));
    guard = 0;
    while (!(await calendar.isBusinessDay(cursor))) {
      cursor = new Date(cursor.getTime() + DAY_MS);
      if (++guard > 3660) throw new Error('addBusinessDays: no business day found within 10 years');
    }
  }
  return cursor;
}

/**
 * Business days elapsed between two instants, to two decimals: whole
 * business days between the two calendar days plus the wall-clock fraction
 * of the partial day.
 */
export async function elapsedBusinessDaysWithCalendar(from: Date, to: Date, calendar: BusinessCalendar): Promise<number> {
  if (to.getTime() <= from.getTime()) return 0;
  const startDay = utcMidnight(from);
  const endDay = utcMidnight(to);
  let whole = 0;
  let cursor = new Date(startDay.getTime() + DAY_MS);
  let guard = 0;
  while (cursor.getTime() <= endDay.getTime()) {
    if (await calendar.isBusinessDay(cursor)) whole++;
    cursor = new Date(cursor.getTime() + DAY_MS);
    if (++guard > 36600) break;
  }
  // Partial-day fraction: time-of-day difference, only counted when both
  // ends fall on business days (a breach on a holiday adds nothing).
  const fromTod = from.getTime() - startDay.getTime();
  const toTod = to.getTime() - endDay.getTime();
  const fraction = (toTod - fromTod) / DAY_MS;
  return roundTo(Math.max(0, whole + fraction), 2);
}

/**
 * Calendar for one approver in one company: department weekly offs plus
 * company holidays, with per-day memoisation (the SLA loop asks about the
 * same handful of days repeatedly).
 */
export async function buildBusinessCalendar(companyId: number, employeeIdForWeeklyOff: number | null): Promise<BusinessCalendar> {
  const weeklyOff = await buildWeeklyOffResolver(companyId, employeeIdForWeeklyOff ? [employeeIdForWeeklyOff] : []);
  const memo = new Map<number, boolean>();
  return {
    async isBusinessDay(date: Date) {
      const day = utcMidnight(date);
      const key = day.getTime();
      const cached = memo.get(key);
      if (cached !== undefined) return cached;
      let result: boolean;
      if (weeklyOff.isWeeklyOff(employeeIdForWeeklyOff ?? -1, day)) result = false;
      else result = !(await isHolidayOrYearlyLeave(companyId, day));
      memo.set(key, result);
      return result;
    },
  };
}

export async function addBusinessDays(companyId: number, employeeIdForWeeklyOff: number | null, from: Date, days: number): Promise<Date> {
  const calendar = await buildBusinessCalendar(companyId, employeeIdForWeeklyOff);
  return addBusinessDaysWithCalendar(from, days, calendar);
}

export async function elapsedBusinessDays(companyId: number, employeeIdForWeeklyOff: number | null, from: Date, to: Date): Promise<number> {
  const calendar = await buildBusinessCalendar(companyId, employeeIdForWeeklyOff);
  return elapsedBusinessDaysWithCalendar(from, to, calendar);
}
