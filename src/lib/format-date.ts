/**
 * Display-only date formatting for the UI. Values from the API are ISO
 * strings (or 'YYYY-MM-DD'); we read the calendar date portion directly so
 * the viewer's timezone can never shift the day.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(value: string | Date | null | undefined): { y: number; m: number; d: number } | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() };
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** "15 Jun 1998" */
export function formatDate(value: string | Date | null | undefined, fallback = '—'): string {
  const p = parts(value);
  if (!p) return fallback;
  return `${String(p.d).padStart(2, '0')} ${MONTHS[p.m - 1]} ${p.y}`;
}

/** "29-01-2026" */
export function formatDateNumeric(value: string | Date | null | undefined, fallback = '—'): string {
  const p = parts(value);
  if (!p) return fallback;
  return `${String(p.d).padStart(2, '0')}-${String(p.m).padStart(2, '0')}-${p.y}`;
}

/** "Apr 2026" */
export function formatMonthYear(value: string | Date | null | undefined, fallback = '—'): string {
  const p = parts(value);
  if (!p) return fallback;
  return `${MONTHS[p.m - 1]} ${p.y}`;
}
