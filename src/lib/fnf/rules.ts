/** Pure F&F formulas from KUN F&F BRD. */

export function round2(n: number): number {
  return Number((Number.isFinite(n) ? n : 0).toFixed(2));
}

export function dailySalary(monthly: number, divisor: number): number {
  const d = divisor > 0 ? divisor : 30;
  return monthly / d;
}

export function salaryPayable(monthly: number, divisor: number, payableDays: number): number {
  return round2(dailySalary(monthly, divisor) * Math.max(0, payableDays));
}

export function prorateComponent(monthly: number, divisor: number, payableDays: number, method: string): number {
  if (method === 'EXCLUDE') return 0;
  if (method === 'FULL') return round2(monthly);
  return salaryPayable(monthly, divisor, payableDays);
}

/** Calendar unpaid days after last processed payroll month (fallback when no attendance). */
export function unpaidPayableDays(
  lastWorkingDay: Date,
  lastPayroll?: { year: number; month: number } | null,
): number {
  const y = lastWorkingDay.getUTCFullYear();
  const m = lastWorkingDay.getUTCMonth() + 1;
  const d = lastWorkingDay.getUTCDate();
  if (!lastPayroll) return Math.max(0, d);
  if (lastPayroll.year > y || (lastPayroll.year === y && lastPayroll.month > m)) return 0;
  if (lastPayroll.year === y && lastPayroll.month === m) return 0;
  const lastEnd = Date.UTC(lastPayroll.year, lastPayroll.month, 0);
  const ms = lastWorkingDay.getTime() - lastEnd;
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function periodStartAfterPayroll(lastWorkingDay: Date, lastPayroll?: { year: number; month: number } | null): Date {
  if (!lastPayroll) return new Date(Date.UTC(lastWorkingDay.getUTCFullYear(), lastWorkingDay.getUTCMonth(), 1));
  const next = new Date(Date.UTC(lastPayroll.year, lastPayroll.month, 1));
  if (next > lastWorkingDay) return new Date(Date.UTC(lastWorkingDay.getUTCFullYear(), lastWorkingDay.getUTCMonth(), 1));
  return next;
}

export function attendanceUnits(status: string): number {
  if (status === 'Present' || status === 'OnDuty' || status === 'Leave') return 1;
  if (status === 'HalfDay' || status === 'Permission') return 0.5;
  return 0;
}

export function sumAttendanceUnits(rows: { status: string; units?: number }[]): number {
  return round2(rows.reduce((s, r) => s + (r.units ?? attendanceUnits(r.status)), 0));
}

export function resolveDivisor(
  mode: string,
  calendarDaysInMonth: number,
  workingDaysInMonth: number,
  configured: number,
): number {
  if (mode === 'CALENDAR') return calendarDaysInMonth || 30;
  if (mode === 'PAYROLL' || mode === 'WORKING') return workingDaysInMonth || configured || 30;
  return configured > 0 ? configured : 30;
}

export function pickSalaryRevisionAsOf<T extends { effectiveFrom: Date; effectiveTo: Date | null }>(
  revisions: T[],
  asOf: Date,
): T | null {
  const t = asOf.getTime();
  const hits = revisions.filter((r) => {
    const from = r.effectiveFrom.getTime();
    const to = r.effectiveTo ? r.effectiveTo.getTime() : Number.POSITIVE_INFINITY;
    return from <= t && t <= to;
  });
  hits.sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  return hits[0] ?? null;
}

export function noticeShortfallDays(required: number, served: number, waived: number): number {
  return Math.max(0, (required || 0) - Math.max(0, served) - Math.max(0, waived));
}

export function noticeExcessDays(required: number, served: number): number {
  return Math.max(0, Math.max(0, served) - (required || 0));
}

/** Signed notice amount: negative = recovery, positive = payable. */
export function noticePayAmount(opts: {
  exitType: string;
  daily: number;
  shortfallDays: number;
  excessDays: number;
}): number {
  const daily = opts.daily;
  if (opts.exitType === 'termination' || opts.exitType === 'death') {
    return round2(daily * opts.shortfallDays);
  }
  if (opts.shortfallDays > 0) return round2(-daily * opts.shortfallDays);
  return 0;
}

export function calendarDaysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/** Excel DATEDIF years / months / days (UTC dates). */
export function datedifYmd(from: Date, to: Date): { years: number; months: number; days: number } {
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  let months = to.getUTCMonth() - from.getUTCMonth();
  let days = to.getUTCDate() - from.getUTCDate();
  if (days < 0) {
    months -= 1;
    const prevMonthLen = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 0)).getUTCDate();
    days += prevMonthLen;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years: Math.max(0, years), months: Math.max(0, months), days: Math.max(0, days) };
}

/** Payment of Gratuity Act: period in excess of six months rounds to the next year. */
export function gratuityCalculationYears(doj: Date, separation: Date): number {
  const { years, months, days } = datedifYmd(doj, separation);
  if (months > 6 || (months === 6 && days > 0)) return years + 1;
  return years;
}

export function earnedBasic(theoreticalBasic: number, presentDays: number, payDays: number): number {
  if (payDays <= 0) return 0;
  return round2(theoreticalBasic * (presentDays / payDays));
}

export function bonusOnEarnedBasic(totalEarnedBasic: number, ratePercent: number): number {
  const rate = ratePercent > 0 ? ratePercent : 8.33;
  return round2(totalEarnedBasic * (rate / 100));
}

/** KUN leave encashment: last-drawn Basic ÷ calendar days in salary month × EL days. No in-service cap. */
export function leaveEncashmentAmount(basic: number, calendarDays: number, elDays: number): number {
  const den = calendarDays > 0 ? calendarDays : 30;
  return round2((basic / den) * Math.max(0, elDays));
}

export function remainingAnnualTax(annualTax: number, alreadyDeducted: number): number {
  return round2(Math.max(0, annualTax - alreadyDeducted));
}

export function isClearanceCleared(
  checks: { checkCode: string; status: string }[],
  exitClearanceStatus: string | null | undefined,
  requiredCodes: readonly string[] = ['MANAGER', 'IT', 'FINANCE', 'HR'],
): boolean {
  return (
    requiredCodes.every((code) => checks.some((c) => c.checkCode === code && c.status === 'CLEARED')) ||
    exitClearanceStatus === 'CLEARED'
  );
}

export function netFromLines(lines: { kind: string; amount: number }[]): {
  totalPayable: number;
  totalRecovery: number;
  netPayable: number;
} {
  const totalPayable = round2(
    lines.filter((l) => l.kind === 'EARNING').reduce((s, l) => s + Number(l.amount), 0),
  );
  const totalRecovery = round2(
    lines.filter((l) => l.kind === 'DEDUCTION').reduce((s, l) => s + Number(l.amount), 0),
  );
  return { totalPayable, totalRecovery, netPayable: round2(totalPayable - totalRecovery) };
}
