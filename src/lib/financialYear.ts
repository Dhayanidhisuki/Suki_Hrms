/**
 * Financial Year / half-year month mapping for the Professional Tax report
 * (BRD §10-11). `financialYear` is the starting calendar year of the FY
 * (e.g. 2026 = FY 2026-27, April 2026 - March 2027) for both half types —
 * the half type only changes which 6 months I/II Half cover, not the FY
 * numbering itself.
 *
 * FINANCIAL:     I Half = Apr-Sep,  II Half = Oct-Mar (next year)
 * NON_FINANCIAL: I Half = Mar-Aug, II Half = Sep-Feb (next year)
 */

export type HalfType = 'FINANCIAL' | 'NON_FINANCIAL';

export interface YearMonth {
  year: number;
  month: number; // 1-12
}

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function monthName(month: number): string {
  return MONTH_NAMES[month];
}

export function financialYearLabel(financialYear: number): string {
  return `${financialYear}-${financialYear + 1}`;
}

export function getHalfYearMonths(financialYear: number, halfType: HalfType, half: 1 | 2): YearMonth[] {
  const startMonth = halfType === 'FINANCIAL' ? 4 : 3; // April or March
  const firstHalfStart = startMonth;
  const secondHalfStart = ((startMonth + 6 - 1) % 12) + 1; // 6 months later, wrapped to 1-12

  const months: YearMonth[] = [];
  let m = half === 1 ? firstHalfStart : secondHalfStart;
  // Second half always begins in the same calendar year as `financialYear`
  // for FINANCIAL (Oct) and NON_FINANCIAL (Sep) — both start months are
  // still >= startMonth's year, only the far end (Jan/Feb, or Jan/Feb for
  // non-financial) rolls into financialYear + 1.
  let y = financialYear;
  for (let i = 0; i < 6; i++) {
    months.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}
