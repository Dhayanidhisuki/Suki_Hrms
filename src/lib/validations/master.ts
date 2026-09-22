/**
 * Zod validation schemas for Master Setup tables.
 * Shared validation core — used by API routes and client-side forms.
 */

import { z } from 'zod';

// ─── Pattern A: Simple master (code + name + description) ────────────────────

const simpleMasterSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

/**
 * An optional numeric field fed by a plain HTML number input, which sends
 * '' rather than omitting the key when left blank — z.coerce would turn
 * that into NaN, so '' (and null) are normalized to undefined first.
 */
function optionalNumber<T extends z.ZodTypeAny>(inner: T) {
  return z.preprocess((v) => (v === '' || v === null ? undefined : v), inner.optional());
}

// Sanctioned headcount — Department, Sub-Department, Designation (KUN BRD
// review, 2026-09-10). "Current" headcount is derived, never written here.
const sanctionedHeadcountField = optionalNumber(z.coerce.number().int().min(0));

export const departmentSchema = simpleMasterSchema.extend({
  sanctionedHeadcount: sanctionedHeadcountField,
});
export const designationSchema = simpleMasterSchema
  .extend({
    budget: optionalNumber(z.coerce.number().min(0)),
    experienceYears: optionalNumber(z.coerce.number().min(0).max(60)),
    qualification: z.string().max(200).nullable().optional(),
    sanctionedHeadcount: sanctionedHeadcountField,
    // Reporting Structure (KUN BRD review, 2026-09-10).
    reportsToId: optionalNumber(z.coerce.number().int().positive()),
  })
  .extend({ code: z.string().max(20).optional() });

// Site Master (KUN BRD review, 2026-09-10) — company-scoped physical
// location; Unit is the legal/org entity, kept separate.
export const siteSchema = z.object({
  code: z.string().max(20).optional(),
  name: z.string().min(1).max(100),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  pinCode: z.string().max(10).optional().nullable(),
  companyId: z.number().int().positive(),
  isActive: z.boolean().default(true),
});
// Code is server-generated for these two (ET001.../CAT001...) — the admin
// never types it, so it's optional on the wire and ignored if sent.
export const employeeTypeSchema = simpleMasterSchema.extend({ code: z.string().max(20).optional() });
export const categorySchema = simpleMasterSchema.extend({ code: z.string().max(20).optional() });
// Grade is defined under a Designation (migration 000022).
export const gradeSchema = simpleMasterSchema.extend({
  designationId: z.coerce.number().int().positive(),
});
// Level is defined under a Grade (migration 000023).
export const levelSchema = simpleMasterSchema.extend({
  gradeId: z.coerce.number().int().positive(),
});
// KUN BRD review (2026-09-10): sanctionable min/max amount.
export const loanTypeSchema = simpleMasterSchema.extend({
  minAmount: optionalNumber(z.coerce.number().min(0)),
  maxAmount: optionalNumber(z.coerce.number().min(0)),
}).refine((v) => v.minAmount == null || v.maxAmount == null || v.minAmount <= v.maxAmount, {
  message: 'Minimum Slab cannot exceed Maximum Slab',
  path: ['minAmount'],
});
export const assetMasterSchema = simpleMasterSchema;

// LeaveMaster adds defaultAnnualDays (how many days of this leave type an
// employee gets per year) plus the accrual/carry-forward rules the annual
// leave-credit job reads (src/lib/leaveAccrual.ts) on top of the simple-
// master shape.
export const leaveMasterSchema = simpleMasterSchema
  .extend({
    defaultAnnualDays: z.coerce.number().min(0).max(365).default(0),
    // MANUAL = credited only by its own earning event (e.g. Compensatory
    // Off, granted when OT worked on a weekly-off/holiday is approved as
    // Comp-Off instead of paid OT) — excluded from the annual credit run.
    accrualType: z.enum(['FIXED_ANNUAL', 'EARNED_PER_DAYS_WORKED', 'MANUAL']).default('FIXED_ANNUAL'),
    daysWorkedPerAccrualUnit: z.coerce.number().int().positive().nullable().optional(),
    carryForwardAllowed: z.boolean().default(false),
    carryForwardMaxDays: z.coerce.number().min(0).nullable().optional(),
  })
  .refine((v) => v.accrualType !== 'EARNED_PER_DAYS_WORKED' || !!v.daysWorkedPerAccrualUnit, {
    message: 'daysWorkedPerAccrualUnit is required when accrualType is EARNED_PER_DAYS_WORKED',
    path: ['daysWorkedPerAccrualUnit'],
  });

// ─── Pattern B: SubDepartment (code + name + description + departmentId FK) ──

// Code is now entered manually per department (e.g. "IT-SUPP").
export const subDepartmentSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  departmentId: z.number().int().positive(),
  sanctionedHeadcount: sanctionedHeadcountField,
  isActive: z.boolean().default(true),
});

// Unit doubles as Branch/Site/Plant/Work Location, scoped to a Company.
// Code is server-generated per company ("<CompanyCode>-001", "-002"...) —
// the admin never types it (migration 000033).
export const unitSchema = z.object({
  code: z.string().max(20).optional(),
  name: z.string().min(1).max(100),
  address: z.string().max(500).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  gstNumber: z.string().max(20).optional().nullable(),
  companyId: z.number().int().positive(),
  isActive: z.boolean().default(true),
});

// Holiday calendar — scoped to a Company like Unit, but date+name instead
// of code+name (no natural short code for a calendar date).
export const HOLIDAY_TYPES = ['COMPANY', 'FESTIVAL', 'GOVERNMENT', 'OTHER'] as const;
export const holidayMasterSchema = z.object({
  date: z.coerce.date(),
  name: z.string().min(1).max(100),
  holidayType: z.enum(HOLIDAY_TYPES).default('OTHER'),
  description: z.string().max(500).optional().nullable(),
  companyId: z.number().int().positive(),
  isActive: z.boolean().default(true),
});

// Per-Employee-Type monthly rate for a benefit salary component (Canteen
// Deduction / Petrol Allowance) — see BenefitRateByEmployeeType in schema.prisma.
export const rateComponentSchema = z.object({
  salaryComponentId: z.coerce.number().int().positive(),
  calculationType: z.enum(['percentage', 'inr']),
  value: z.coerce.number().nonnegative(),
});

export const benefitRateSchema = z.object({
  companyId: z.number().int().positive(),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  employeeTypeId: z.number().int().positive(),
  salaryComponentId: z.number().int().positive().optional().nullable(),
  amount: z.coerce.number().min(0),
  isActive: z.boolean().default(true),
});

// ─── Pattern C: ShiftMaster (code + name + times + grace) ────────────────────

export const shiftMasterSchema = z.object({
  code: z.string().max(20).optional(),
  name: z.string().min(1).max(100),
  startTime: z.string().min(1).max(8),
  endTime: z.string().min(1).max(8),
  graceMinutes: z.number().int().min(0).default(0),
  // KUN BRD review (2026-09-10): night/snacks/meals allowances.
  nightAllowed: z.boolean().default(false),
  bufferMinutes: z.preprocess((v) => (v === '' ? 0 : v), z.coerce.number().int().min(0)).default(0),
  snacksAllowed: z.boolean().default(false),
  mealsAllowed: z.boolean().default(false),
  snacksMealsDurationMinutes: optionalNumber(z.coerce.number().int().min(0)),
  // Phase 2A.6 (2026-09-11): configurable break time and allowance amounts.
  breakMinutes: z.preprocess((v) => (v === '' ? 0 : v), z.coerce.number().int().min(0)).default(0),
  nightAllowanceAmount: optionalNumber(z.coerce.number().min(0)),
  nightAllowanceFromHour: optionalNumber(z.coerce.number().int().min(0).max(23)),
  snacksAllowanceAmount: optionalNumber(z.coerce.number().min(0)),
  foodAllowanceAmount: optionalNumber(z.coerce.number().min(0)),
  mealsAllowanceAmount: optionalNumber(z.coerce.number().min(0)),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

// ─── Pattern C: OTPlan (code + name + OT rate fields) ────────────────────────

export const otPlanSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  otRateMultiplier: z.coerce.number().positive().max(10),
  otCalculationBasis: z.enum(['GROSS', 'BASIC', 'BASIC_DA', 'BASIC_DA_HRA', 'FIXED']).default('GROSS'),
  applicableAfterMinutes: z.number().int().min(0).default(0),
  // Payable OT is floored to the last completed wall-clock mark of this
  // size (e.g. 60 → the top of the hour), not N minutes from shift-end —
  // see OTPlan.roundingSlabMinutes in schema.prisma. NULL = no rounding.
  roundingSlabMinutes: optionalNumber(z.coerce.number().int().positive()),
  maxOtHoursPerDay: z.number().int().positive().optional().nullable(),
  // KUN BRD review (2026-09-10): which SalaryComponent the calculated OT
  // amount pays through.
  payComponentId: optionalNumber(z.coerce.number().int().positive()),
  // Phase 2B.1 (2026-09-11): day-type multipliers, weekly/monthly caps, settlement.
  weekdayFactor: z.coerce.number().min(0).max(10).default(1),
  weeklyOffFactor: z.coerce.number().min(0).max(10).default(1.5),
  holidayFactor: z.coerce.number().min(0).max(10).default(2),
  maxOtHoursPerWeek: optionalNumber(z.coerce.number().int().positive()),
  maxOtHoursPerMonth: optionalNumber(z.coerce.number().int().positive()),
  weeklyOffSettlement: z.enum(['COMP_OFF', 'PAYMENT', 'CHOICE']).default('PAYMENT'),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});


// ─── Pattern F: ShiftRotationPlan (code + name + anchor date + ordered shift cycle) ─

export const shiftRotationPlanSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  anchorDate: z.coerce.date(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
  // Ordered list of ShiftMaster ids — index 0 applies the week of
  // anchorDate, index 1 the week after, etc., wrapping back to 0.
  shiftMasterIds: z.array(z.number().int().positive()).min(2).max(12),
});

// ─── Pattern E: Slab/rate tables (versioned, overlap validation) ─────────────

export const tdsSlabSchema = z.object({
  code: z.string().min(1).max(20),
  minSalary: z.coerce.number().nonnegative(),
  maxSalary: z.coerce.number().positive().optional().nullable(),
  ratePercent: z.coerce.number().positive().max(100),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  isActive: z.boolean().default(true),
});

// Deduction Rates (KUN BRD review, 2026-09-10, item 15). Company-scoped
// (companyId comes from the session, not the body, same convention as
// every other company-scoped write). `isLop` flags a Loss-of-Pay row.
export const deductionRateSchema = z
  .object({
    code: z.string().min(1).max(20),
    name: z.string().min(1).max(100),
    deductionType: z.enum(['PERCENT', 'FLAT']),
    rateValue: z.coerce.number().nonnegative(),
    isLop: z.boolean().default(false),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .refine((v) => v.deductionType !== 'PERCENT' || v.rateValue <= 100, {
    message: 'A percentage rate cannot exceed 100',
    path: ['rateValue'],
  });

export const professionalTaxSlabSchema = z.object({
  code: z.string().min(1).max(20),
  minSalary: z.coerce.number().nonnegative(),
  maxSalary: z.coerce.number().positive().optional().nullable(),
  monthlyAmount: z.coerce.number().nonnegative(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const esiRateSchema = z.object({
  code: z.string().min(1).max(20),
  employeeContributionRate: z.coerce.number().nonnegative().max(100),
  employerContributionRate: z.coerce.number().nonnegative().max(100),
  wageCeilingMonthly: z.coerce.number().nonnegative(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  isActive: z.boolean().default(true),
  components: z.array(rateComponentSchema).optional().default([]),
});

export const pfRateSchema = z.object({
  code: z.string().min(1).max(20),
  employeeContributionRate: z.coerce.number().nonnegative().max(100),
  employerContributionRate: z.coerce.number().nonnegative().max(100),
  pensionContributionRate: z.coerce.number().nonnegative().max(100).optional().nullable(),
  wageCeilingMonthly: z.coerce.number().nonnegative(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  isActive: z.boolean().default(true),
  components: z.array(rateComponentSchema).optional().default([]),
});

// Company-scoped since migration 000013 (companyId comes from the session,
// not the body — same convention as salaryComponentSchema below). 8.33% is
// a hard floor on both rate fields, not just documented — a company can set
// its base/min rate at or above the statutory minimum, never below it.
export const bonusRateSchema = z
  .object({
    code: z.string().min(1).max(20),
    calculationType: z.enum(['BASIC_PROJECTION', 'ACTUAL_NET_PAY']),
    ratePercent: z.coerce.number().min(8.33).max(100),
    minRatePercent: z.coerce.number().min(8.33).max(100),
    maxRatePercent: z.coerce.number().min(8.33).max(100),
    wageEligibilityCeiling: z.coerce.number().nonnegative(),
    calculationWageCeiling: z.coerce.number().nonnegative(),
    minWorkingDays: z.coerce.number().int().nonnegative().default(30),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.minRatePercent <= data.maxRatePercent, {
    message: 'minRatePercent cannot exceed maxRatePercent',
    path: ['minRatePercent'],
  })
  .refine((data) => data.ratePercent >= data.minRatePercent && data.ratePercent <= data.maxRatePercent, {
    message: 'ratePercent must be between minRatePercent and maxRatePercent',
    path: ['ratePercent'],
  });

// Company-scoped (companyId comes from the session, not the body). The
// numerator/denominator pair stays configurable rather than hard-coding
// "15/26" — BRD's own explicit requirement (Gratuity BRD §9).
export const gratuityPolicySchema = z.object({
  code: z.string().min(1).max(20),
  policyName: z.string().min(1).max(100),
  multiplierNumerator: z.coerce.number().positive().default(15),
  multiplierDenominator: z.coerce.number().positive().default(26),
  minEligibleServiceYears: z.coerce.number().nonnegative().default(5),
  maxGratuityCeiling: z.coerce.number().nonnegative(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  isActive: z.boolean().default(true),
});

// ─── Pattern F: DropdownMaster ───────────────────────────────────────────────

export const dropdownMasterSchema = z.object({
  category: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  value: z.string().min(1).max(100),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// Common Logic > Gross % Split (KUN BRD review, 2026-09-10). companyId comes
// from the session, not the body, same convention as other company-scoped
// writes. Bulk-saved as a set — see /api/masters/gross-split-rules.
export const grossSplitRuleSchema = z.object({
  salaryComponentId: z.number().int().positive(),
  percentOfGross: z.coerce.number().min(0).max(100),
  isActive: z.boolean().default(true),
});
export const grossSplitRuleBulkSchema = z.object({
  rules: z.array(grossSplitRuleSchema).max(200),
});

// Company-scoped since migration 000012 — companyId comes from the session
// (getCompanyId()), never the request body, same convention as every other
// company-scoped write this session.
export const salaryComponentSchema = z.object({
  code: z.string().min(1).max(30),
  name: z.string().min(1).max(100),
  type: z.enum(['earning', 'deduction', 'employer_contribution']),
  includeInGratuity: z.boolean().default(false),
  // KUN BRD review (2026-09-10): whether this component counts toward the
  // ESI / PF eligible-wage base.
  includeInEsi: z.boolean().default(false),
  includeInPf: z.boolean().default(false),
  // Whether this earning component counts toward Gross Salary. When false
  // the component is CTC-only (e.g. performance incentive paid from PMS) —
  // paid out but never part of Gross or a statutory base.
  includeInGross: z.boolean().default(true),
  // Which Gross tier this earning belongs to for payslip subtotals.
  // NON_PAYROLL = never touched by payroll at all (see schema.prisma comment
  // on SalaryComponent.grossTier); used for CTC-quoted, display-only figures
  // like Performance Incentive.
  // PAYROLL_HIDDEN = the opposite of NON_PAYROLL: it DOES reduce Net Pay in
  // real payroll (shows on Payroll Processing/Payslip like a normal
  // deduction), but is attached per-employee via the CTC Components picker
  // and deliberately not offered/shown on the Salary Details tab.
  grossTier: z.enum(['FIXED', 'ADDITIONAL', 'NON_PAYROLL', 'PAYROLL_HIDDEN']).default('ADDITIONAL'),
  fnfPayable: z.boolean().default(true),
  fnfProration: z.enum(['PRO_RATA', 'FULL', 'EXCLUDE']).default('PRO_RATA'),
  fnfTaxable: z.boolean().default(true),
  isActive: z.boolean().default(true),
  // Optional convenience: setting this here upserts the same GrossSplitRule
  // row the Common Logic > Gross % Split page manages, so an earning
  // component's fixed share of Gross can be set right where the component
  // itself is created — see PUT /api/masters/gross-split-rules and its use
  // from src/app/masters/salary-components/route.ts. null/omitted leaves any
  // existing rule untouched; only meaningful for type = 'earning'.
  percentOfGross: optionalNumber(z.coerce.number().min(0).max(100)),
});

// A NON_PAYROLL component must never be touched by payroll — force every
// payroll-facing flag off regardless of what was submitted, so it can't be
// wired into Gross/PF/ESI/Gratuity by accident via the flag checkboxes.
export function normalizeSalaryComponentFlags<T extends { grossTier?: string; includeInGross?: boolean; includeInPf?: boolean; includeInEsi?: boolean; includeInGratuity?: boolean }>(data: T): T {
  if (data.grossTier !== 'NON_PAYROLL') return data;
  return { ...data, includeInGross: false, includeInPf: false, includeInEsi: false, includeInGratuity: false };
}

// ─── Slab overlap validation (app-layer, Q5) ─────────────────────────────────

/**
 * Validates that a new/updated slab record doesn't overlap with existing records
 * for the same code. Returns an error message if overlap detected, null otherwise.
 */
export function validateSlabOverlap(
  existing: Array<{ effectiveFrom: Date; effectiveTo: Date | null }>,
  newFrom: Date,
  newTo: Date | null,
  excludeId?: number
): string | null {
  const newEnd = newTo ?? new Date('9999-12-31');

  for (const rec of existing) {
    if (excludeId && (rec as { id?: number }).id === excludeId) continue;
    const recEnd = rec.effectiveTo ?? new Date('9999-12-31');
    if (newFrom < recEnd && newEnd > rec.effectiveFrom) {
      return `Effective date range overlaps with an existing record (${rec.effectiveFrom.toISOString().split('T')[0]} to ${rec.effectiveTo ? rec.effectiveTo.toISOString().split('T')[0] : 'current'}).`;
    }
  }
  return null;
}

// ─── Dynamic Payroll Config (Phase 2A) — company-scoped single-row ───────────

export const lomConfigSchema = z.object({
  calculationBasis: z.enum(['GROSS', 'BASIC']).default('GROSS'),
  multiplier: z.coerce.number().min(0.01).max(10).default(1),
  shiftDurationSource: z.enum(['FIXED_8', 'SHIFT_MASTER']).default('FIXED_8'),
  payrollDaysDenominator: z.enum(['CALENDAR', 'FIXED_26']).default('CALENDAR'),
  graceMinutesExempt: z.coerce.number().int().min(0).default(0),
  dailyLomCap: optionalNumber(z.coerce.number().int().min(0)),
  isActive: z.boolean().default(true),
});

export const roundingConfigSchema = z.object({
  roundingMode: z.enum(['NONE', 'NEAREST_1', 'NEAREST_5', 'NEAREST_10', 'NEAREST_100']).default('NEAREST_1'),
  applyTo: z.enum(['NET_ONLY', 'ALL_COMPONENTS']).default('NET_ONLY'),
  showRoundOff: z.boolean().default(true),
});

export const payrollValidationConfigSchema = z.object({
  allowNegativeNet: z.boolean().default(false),
  minNetPercentOfGross: z.coerce.number().min(0).max(100).default(0),
  requireApprovalIfNegative: z.boolean().default(true),
  maxDeductionPercent: z.coerce.number().min(0).max(100).default(100),
  statutoryIncludedInLimit: z.boolean().default(true),
});

export const payrollWorkflowConfigSchema = z.object({
  enableValidatedStage: z.boolean().default(false),
  enableSubmittedStage: z.boolean().default(false),
  enablePostedStage: z.boolean().default(false),
  approvalStages: z.enum(['HR', 'MANAGER_HR', 'HR_FINANCE', 'MANAGER_HR_FINANCE']).default('HR'),
  cutoffDayOfMonth: optionalNumber(z.coerce.number().int().min(1).max(31)),
  allowReopenAfterLock: z.boolean().default(true),
  reopenRequiresReason: z.boolean().default(true),
});

export const payrollDisplayConfigSchema = z.object({
  showDeductionPercent: z.boolean().default(true),
  decimalPlaces: z.coerce.number().int().min(0).max(4).default(2),
  showYTD: z.boolean().default(false),
  showLeaveBalance: z.boolean().default(false),
  showTaxBreakdown: z.boolean().default(false),
});

// ─── Time Office Config (Phase 2B) ───────────────────────────────────────────

export const compOffPolicySchema = z.object({
  minQualifyingHours: z.coerce.number().int().min(0).default(4),
  qualifyingDayTypes: z.string().max(100).default('WEEKLY_OFF,HOLIDAY'),
  requiresApproval: z.boolean().default(true),
  expiryMonths: z.coerce.number().int().min(0).default(3),
  allowEncashment: z.boolean().default(false),
  encashmentRatePerDay: optionalNumber(z.coerce.number().min(0)),
  autoCreditOnApproval: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const otIncentiveSlabSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  minOtHours: z.coerce.number().min(0),
  maxOtHours: optionalNumber(z.coerce.number().min(0)),
  incentiveMultiplier: z.coerce.number().min(0.01).max(10).default(1),
  // A fixed monthly bonus for this band, e.g. INR 500 for 50+ OT hours.
  // When set, this slab pays flatBonusAmount and incentiveMultiplier is ignored.
  flatBonusAmount: optionalNumber(z.coerce.number().min(0)),
  effectiveFrom: z.coerce.date(),
  effectiveTo: optionalNumber(z.coerce.date()),
  isActive: z.boolean().default(true),
});

export const attendanceBonusConfigSchema = z.object({
  bonusAmount: z.coerce.number().min(0).default(0),
  requiresZeroLop: z.boolean().default(true),
  requiresZeroLate: z.boolean().default(false),
  requiresZeroEarlyOut: z.boolean().default(false),
  prorateByPayableDays: z.boolean().default(false),
  minPayableDaysPercent: z.coerce.number().min(0).max(100).default(100),
  isActive: z.boolean().default(true),
});

// ─── Statutory Config (Phase 2C) ─────────────────────────────────────────────

export const lwfRateSchema = z.object({
  code: z.string().min(1).max(20),
  state: z.string().min(1).max(50),
  employeeRate: z.coerce.number().min(0),
  employerRate: z.coerce.number().min(0),
  rateType: z.enum(['FLAT', 'PERCENT']).default('FLAT'),
  frequency: z.enum(['MONTHLY', 'HALF_YEARLY', 'YEARLY']).default('MONTHLY'),
  deductionMonth: z.coerce.number().int().min(1).max(12).default(1),
  effectiveFrom: z.coerce.date(),
  effectiveTo: optionalNumber(z.coerce.date()),
  isActive: z.boolean().default(true),
});

export const statePtConfigSchema = z.object({
  code: z.string().min(1).max(20),
  state: z.string().min(1).max(50),
  slabCode: z.string().min(1).max(20),
  effectiveFrom: z.coerce.date(),
  effectiveTo: optionalNumber(z.coerce.date()),
  isActive: z.boolean().default(true),
});

export const tdsRegimeConfigSchema = z.object({
  defaultRegime: z.enum(['OLD', 'NEW']).default('NEW'),
  financialYearStart: z.coerce.number().int().min(1).max(12).default(4),
  cessRate: z.coerce.number().min(0).max(100).default(4),
  surchargeThreshold: z.coerce.number().min(0).default(5000000),
  surchargeRate: z.coerce.number().min(0).max(100).default(10),
  rebateUptoIncome: z.coerce.number().min(0).default(500000),
  rebateAmount: z.coerce.number().min(0).default(12500),
  standardDeduction: z.coerce.number().min(0).default(50000),
  isActive: z.boolean().default(true),
});

export const healthInsuranceConfigSchema = z.object({
  employeeContributionRate: z.coerce.number().min(0).max(100).default(0),
  employerContributionRate: z.coerce.number().min(0).max(100).default(0),
  monthlyPremium: z.coerce.number().min(0).default(0),
  applyToAllEmployees: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

// ─── Phase 2D — Leave Encashment, FnF, Bank File ──────────────────────────────

export const leaveEncashmentConfigSchema = z.object({
  calculationBasis: z.enum(['GROSS', 'BASIC', 'BASIC_DA']).default('GROSS'),
  denominator: z.coerce.number().int().min(1).max(31).default(26),
  minServiceMonths: z.coerce.number().int().min(0).default(0),
  maxEncashableDays: z.coerce.number().int().min(0).default(45),
  includeEarnedOnly: z.boolean().default(true),
  prorateByLop: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const fullAndFinalConfigSchema = z.object({
  includeUnpaidSalary: z.boolean().default(true),
  includeLeaveEncashment: z.boolean().default(true),
  includeGratuity: z.boolean().default(true),
  includeBonusProportion: z.boolean().default(true),
  includeNoticePay: z.boolean().default(true),
  noticePeriodDays: z.coerce.number().int().min(0).default(30),
  includeLoanRecovery: z.boolean().default(true),
  includeAssetRecovery: z.boolean().default(true),
  salaryDivisor: z.coerce.number().int().min(1).max(31).default(30),
  salaryDivisorMode: z.enum(['DAYS_30', 'CALENDAR', 'PAYROLL', 'WORKING']).default('CALENDAR'),
  noticeRateBasis: z.enum(['GROSS', 'BASIC', 'BASIC_DA']).default('GROSS'),
  includeTds: z.boolean().default(true),
  includePf: z.boolean().default(true),
  includeEsi: z.boolean().default(true),
  includePt: z.boolean().default(true),
  clearanceRequired: z.boolean().default(true),
  approvalStages: z.enum(['HR', 'HR_FINANCE', 'MANAGER_HR_FINANCE']).default('HR_FINANCE'),
  isActive: z.boolean().default(true),
});

export const bankFileTemplateSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  bankName: z.string().min(1).max(100),
  fileFormat: z.enum(['CSV', 'XLSX', 'TXT', 'FIXED_WIDTH']).default('CSV'),
  delimiter: z.string().max(5).default(','),
  columnMapping: z.string().min(1).max(2000),
  headerRow: z.boolean().default(true),
  footerRow: z.boolean().default(false),
  footerTemplate: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

// ─── Phase 4 — TDS Investment Declarations & Proofs ──────────────────────────

export const tdsInvestmentDeclarationSchema = z.object({
  financialYear: z.coerce.number().int().min(2000).max(2100),
  regime: z.enum(['OLD', 'NEW']).default('NEW'),
  section80C: z.coerce.number().min(0).max(150000).default(0),
  section80D: z.coerce.number().min(0).max(100000).default(0),
  section80CCD: z.coerce.number().min(0).max(50000).default(0),
  section80G: z.coerce.number().min(0).default(0),
  section80E: z.coerce.number().min(0).default(0),
  section80TTA: z.coerce.number().min(0).max(10000).default(0),
  otherDeductions: z.coerce.number().min(0).default(0),
  hraExemption: z.coerce.number().min(0).default(0),
  otherIncome: z.coerce.number().min(0).default(0),
  remarks: z.string().max(500).optional().nullable(),
});

export const tdsInvestmentProofSchema = z.object({
  section: z.enum(['80C', '80D', '80CCD', '80G', '80E', '80TTA', 'OTHER', 'HRA']),
  amount: z.coerce.number().min(0),
  description: z.string().max(500).optional().nullable(),
  documentUrl: z.string().max(500).optional().nullable(),
});

// ─── Phase 6 — Loans and Advances ────────────────────────────────────────────

export const loanSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  loanTypeId: z.coerce.number().int().positive(),
  code: z.string().min(1).max(20),
  principal: z.coerce.number().min(0.01),
  interestRate: z.coerce.number().min(0).max(100).default(0),
  tenureMonths: z.coerce.number().int().min(1),
  installmentAmount: z.coerce.number().min(0.01),
  disbursementDate: z.coerce.date(),
  firstDeductionMonth: z.coerce.number().int().min(1).max(12).optional().nullable(),
  firstDeductionYear: z.coerce.number().int().optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

// ─── Phase 9 — Incentives & Allowances ───────────────────────────────────────

export const incentivePolicySchema = z.object({
  type: z.enum(['ATTENDANCE_BONUS', 'SHIFT_BONUS', 'PRODUCTION', 'SPECIAL', 'OTHER']),
  name: z.string().min(1).max(100),
  amount: z.coerce.number().min(0),
  calculationType: z.enum(['FLAT', 'FORMULA']).default('FLAT'),
  formula: z.string().max(500).optional().nullable(),
  eligibility: z.string().max(500).optional().nullable(),
  eligibleShiftCodes: z.string().max(200).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const doubleMachineEntrySchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  date: z.coerce.date(),
  machine1: z.string().max(50).optional().nullable(),
  machine2: z.string().max(50).optional().nullable(),
  numMachines: z.coerce.number().int().min(1).max(10).default(1),
  workingHours: z.coerce.number().min(0).max(24),
  incentiveRate: z.coerce.number().min(0),
  hrRemarks: z.string().max(500).optional().nullable(),
});

export const canteenTokenSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  date: z.coerce.date(),
  tokensUsed: z.coerce.number().int().min(0),
  ratePerToken: z.coerce.number().min(0),
  companyContribution: z.coerce.number().min(0).default(0),
});

export const petrolAllowanceEntrySchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  travelDate: z.coerce.date(),
  km: z.coerce.number().min(0),
  ratePerKm: z.coerce.number().min(0),
});

export const allowanceConfigSchema = z.object({
  componentCode: z.string().min(1).max(30),
  amount: z.coerce.number().min(0),
  eligibilityType: z.enum(['ALL', 'DESIGNATION', 'DEPARTMENT', 'SHIFT']).default('ALL'),
  eligibilityValue: z.string().max(200).optional().nullable(),
  isActive: z.boolean().default(true),
});
