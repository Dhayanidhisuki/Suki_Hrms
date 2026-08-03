/** Preventive MNT helpers — unit-level NXT_PRE_DATE flow (no dedicated module screens). */

export function isAssetYes(value: string | null | undefined): boolean {
  const v = (value ?? "").trim().toUpperCase();
  return v === "YES" || v === "Y";
}

export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Clamp month-end overflow (Jan 31 + 1m → Mar 3 in some engines)
  if (d.getDate() < day) d.setDate(0);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function computeNextPreDate(opts: {
  from?: Date | null;
  frequencyMonths: number;
}): Date | null {
  const freq = Number(opts.frequencyMonths);
  if (!Number.isFinite(freq) || freq <= 0) return null;
  return addMonths(opts.from ?? new Date(), freq);
}

export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export type PreventiveDueStatus = "Overdue" | "Due Soon" | "Scheduled" | "Not Set";

export function preventiveDueStatus(
  nextPreDate: Date | string | null | undefined,
  alertDays = 30
): PreventiveDueStatus {
  const left = daysUntil(nextPreDate);
  if (left == null) return "Not Set";
  if (left < 0) return "Overdue";
  if (left <= alertDays) return "Due Soon";
  return "Scheduled";
}
