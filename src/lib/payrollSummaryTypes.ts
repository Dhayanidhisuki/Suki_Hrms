/**
 * Response of GET /api/reports/payroll-summary.
 *
 * Shared by the Salary Cost and Statutory Summary dashboards, which are two
 * readings of the same payroll run rather than two separate aggregations.
 */
export interface PayrollSummaryReport {
  run: { id: number; year: number; month: number; status: string };
  headcount: { total: number; ok: number; hold: number };
  totals: {
    grossEarnings: number;
    otAmount: number;
    otherEarnings: number;
    pfEmployee: number;
    pfEmployer: number;
    esiEmployee: number;
    esiEmployer: number;
    professionalTax: number;
    tds: number;
    otherDeductions: number;
    lomAmount: number;
    lwfAmount: number;
    healthInsurance: number;
    licAmount: number;
    netSalary: number;
  };
  byDepartment: Array<{ department: string; count: number; gross: number; net: number }>;
  holdReasons: Array<{ employeeCode: string; name: string; holdReason: string | null }>;
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** ₹ in Indian short scale — what an Indian payroll reader expects. */
export function inrShort(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function inr(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
