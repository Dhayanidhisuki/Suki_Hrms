/**
 * Shared performance-period helpers.
 *
 * The weighted-score function that used to live here scored the ERP-era
 * EmployeeKraLine table, which migration 000067 dropped. Scoring is BRD
 * §22 and belongs with the assessment module, against EmployeeGoalKpi.
 */

/** Financial year label for a date, Apr-Mar. e.g. "2026-27". */
export function currentFinancialYear(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based; FY Apr–Mar
  const start = m >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}
