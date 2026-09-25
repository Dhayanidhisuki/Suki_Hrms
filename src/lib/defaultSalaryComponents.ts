/**
 * The starter SalaryComponent catalog every company gets seeded with —
 * source of truth for both scripts/seed-salary-components.mjs (used once,
 * historically, to seed company 1 from payroll.rpt) and
 * POST /api/superadmin/companies/[id]/bootstrap-admin (seeds every new
 * company automatically, migration 000012 onward).
 *
 * isSystemDefined marks the 7 codes Payroll/Arrear/Bonus depend on by exact
 * code — src/lib/payrollCalculation.ts (PF, ESI), src/lib/arrearApply.ts
 * (ARREAR_GROSS, ARREAR_PF, ARREAR_ESI), src/lib/bonusApply.ts (BONUS),
 * src/lib/bonusCalculation.ts (BASIC). The Masters CRUD routes
 * (src/app/api/masters/salary-components/**) refuse to edit or delete a row
 * where this is true, so a company admin can't break the built-in
 * calculations — they can still freely add their own components alongside
 * them.
 */

export interface DefaultSalaryComponent {
  code: string;
  name: string;
  type: 'earning' | 'deduction' | 'employer_contribution';
  isSystemDefined: boolean;
}

const SYSTEM_DEFINED_CODES = new Set(['BASIC', 'PF', 'ESI', 'ARREAR_GROSS', 'ARREAR_PF', 'ARREAR_ESI', 'BONUS', 'COMPOFF_ENCASH']);

// [code, name, type] — the original 35 rows are from payroll.rpt's
// COMPONENT / DEFAULT_LABLE / LOGIC_TYPE columns (no formulas seeded, spec
// forbids inventing calc logic); ARREAR_GROSS/ARREAR_PF/ARREAR_ESI/BONUS
// were added in Tiers 4/5a for the ad-hoc-line-into-Payroll mechanism.
const RAW: [string, string, DefaultSalaryComponent['type']][] = [
  ['BASIC', 'Basic Salary', 'earning'],
  ['SRA', 'SRA', 'earning'],
  ['QA', 'QA', 'earning'],
  ['FDA', 'SRA', 'earning'],
  ['SNACKS', 'Snacks Allowance', 'earning'],
  ['CONVEYANCE', 'Conv.Allow', 'earning'],
  ['SPL_ALLOW', 'Spl.Allowance', 'earning'],
  ['HEAT', 'Heat Allowance', 'earning'],
  ['WASH', 'Wash Allowance', 'earning'],
  ['HRA', 'HRA', 'earning'],
  ['NIGHT_SHIFT', 'Night Shift Allowance', 'earning'],
  ['DA', 'DA', 'earning'],
  ['EDUCATION', 'Education Allowance', 'earning'],
  ['ATTENDANCE', 'Attendance Incentive for 100% Attendance', 'earning'],
  ['ADD_HRA', 'Additional HRA', 'earning'],
  ['HEALTH', 'Health Allowance', 'earning'],
  ['CANTEEN', 'Canteen Allowance', 'earning'],
  ['GUEST_HOUSE', 'Guest.House Allowance', 'earning'],
  ['CCA', 'CCA', 'earning'],
  ['DIS_LOCATION', 'Dis.Location.Allow', 'earning'],
  ['OTHER1', 'Other Allowance', 'earning'],
  ['OTHER2', 'Other Allowance 2', 'earning'],
  ['OTHER3', 'Other Allowance 3', 'earning'],
  ['LUNCH_PER_DAY', 'Lunch Allowance Per/Day', 'earning'],
  ['FOOD', 'Food Allowance', 'earning'],
  ['PROD_INS', 'Prod.Incentive', 'earning'],
  ['PERFORMANCE_INS', 'Performance Incentive', 'earning'],
  ['PERFORMANCE', 'Performance Allowance', 'earning'],
  ['ESI', 'Esi Allowance', 'deduction'],
  ['PF', 'PF', 'deduction'],
  ['LIC', 'LIC', 'deduction'],
  ['LWF', 'LWF', 'deduction'],
  ['ATTENDANCE1', 'Attendance Bonus if 1 day leave', 'earning'],
  ['ATTENDANCE2', 'Attendance Bonus if 2 days leave', 'earning'],
  ['OTHER_DED2', 'Other Deduction2', 'deduction'],
  ['ARREAR_GROSS', 'Salary Arrear', 'earning'],
  ['ARREAR_PF', 'PF Arrear', 'deduction'],
  ['ARREAR_ESI', 'ESI Arrear', 'deduction'],
  ['BONUS', 'Bonus', 'earning'],
  ['COMPOFF_ENCASH', 'Comp-Off Encashment', 'earning'],

  // Employee Benefits & Allowances (client BRD): CANTEEN_DED is deliberately
  // separate from the existing CANTEEN earning row — the BRD's "Canteen
  // Deduction" is money taken FROM salary for canteen use, not an
  // allowance paid out. PETROL_ALLOW/DOUBLE_MACHINE/EXTRA_WORK/
  // REFERRAL_BONUS have no existing row to reuse. Applied via
  // BenefitRateByEmployeeType + the payroll ad-hoc-line mechanism, not a
  // recurring EmployeeSalaryComponent.
  ['CANTEEN_DED', 'Canteen Deduction', 'deduction'],
  ['PETROL_ALLOW', 'Petrol Allowance', 'earning'],
  ['DOUBLE_MACHINE', 'Double Machine Allowance', 'earning'],
  ['EXTRA_WORK', 'Extra Work Allowance', 'earning'],
  ['REFERRAL_BONUS', 'Referral Bonus', 'earning'],

  // The codes payrollCalculation.ts actually looks up when crediting the
  // monthly incentives, and that both the OT & Other Incentive register and
  // the Double Machine report query by. They were never in this catalog, so
  // the lookups found nothing: the amounts were still PAID (they go into
  // autoEarningsTotal regardless) but no PayrollLineComponent was written, so
  // every one of them collapsed into the payslip's "Other Earnings" line
  // instead of appearing under its own name.
  //
  // Note the four rows above overlap these conceptually (DOUBLE_MACHINE vs
  // DM_INCENTIVE, PETROL_ALLOW vs PETROL, REFERRAL_BONUS vs EMP_REFERRAL).
  // The rows above are referenced by no code at all — they were added for the
  // BenefitRateByEmployeeType / ad-hoc-line mechanism. The codes below are the
  // operative ones. Left both rather than renaming, because a company may
  // already have ad-hoc payroll lines pointing at the older codes.
  ['DM_INCENTIVE', 'Double Machine Incentive', 'earning'],
  ['ATT_BONUS', 'Attendance Bonus', 'earning'],
  ['SHIFT_BONUS', 'Shift Incentive', 'earning'],
  ['PETROL', 'Petrol Allowance', 'earning'],
  ['OT_WEEKLY_INC', 'OT Weekly Incentive', 'earning'],
  ['EMP_REFERRAL', 'Employee Referral', 'earning'],
];

export const DEFAULT_SALARY_COMPONENTS: DefaultSalaryComponent[] = RAW.map(([code, name, type]) => ({
  code,
  name,
  type,
  isSystemDefined: SYSTEM_DEFINED_CODES.has(code),
}));
