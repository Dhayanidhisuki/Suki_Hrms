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
export const designationSchema = simpleMasterSchema.extend({
  budget: optionalNumber(z.coerce.number().min(0)),
  experienceYears: optionalNumber(z.coerce.number().min(0).max(60)),
  qualification: z.string().max(200).nullable().optional(),
  sanctionedHeadcount: sanctionedHeadcountField,
  // Reporting Structure (KUN BRD review, 2026-09-10).
  reportsToId: optionalNumber(z.coerce.number().int().positive()),
});

// Site Master (KUN BRD review, 2026-09-10) — company-scoped physical
// location; Unit is the legal/org entity, kept separate.
export const siteSchema = z.object({
  code: z.string().min(1).max(20),
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

// Code is server-generated per department ("<DeptCode>-001", "-002"...) —
// the admin never types it (migration 000031).
export const subDepartmentSchema = z.object({
  code: z.string().max(20).optional(),
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
  code: z.string().min(1).max(20),
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
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

// ─── Pattern C: OTPlan (code + name + OT rate fields) ────────────────────────

export const otPlanSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  otRateMultiplier: z.coerce.number().positive().max(10),
  applicableAfterMinutes: z.number().int().min(0).default(0),
  maxOtHoursPerDay: z.number().int().positive().optional().nullable(),
  // KUN BRD review (2026-09-10): which SalaryComponent the calculated OT
  // amount pays through.
  payComponentId: optionalNumber(z.coerce.number().int().positive()),
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
  isActive: z.boolean().default(true),
});

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
