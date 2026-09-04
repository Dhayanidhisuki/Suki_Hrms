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

export const departmentSchema = simpleMasterSchema;
export const designationSchema = simpleMasterSchema;
export const employeeTypeSchema = simpleMasterSchema;
export const categorySchema = simpleMasterSchema;
export const gradeSchema = simpleMasterSchema;
export const levelSchema = simpleMasterSchema;
export const leaveMasterSchema = simpleMasterSchema;
export const loanTypeSchema = simpleMasterSchema;
export const assetMasterSchema = simpleMasterSchema;

// ─── Pattern B: SubDepartment (code + name + description + departmentId FK) ──

export const subDepartmentSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  departmentId: z.number().int().positive(),
  isActive: z.boolean().default(true),
});

// Unit doubles as Branch/Site/Plant/Work Location, scoped to a Company.
export const unitSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  companyId: z.number().int().positive(),
  isActive: z.boolean().default(true),
});

// ─── Pattern C: ShiftMaster (code + name + times + grace) ────────────────────

export const shiftMasterSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  startTime: z.string().min(1).max(8),
  endTime: z.string().min(1).max(8),
  graceMinutes: z.number().int().min(0).default(0),
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
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

// ─── Pattern D: ShiftPlan (code + name + FK + optional overrides) ────────────

export const shiftPlanSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  shiftMasterId: z.number().int().positive(),
  startTime: z.string().max(8).optional().nullable(),
  endTime: z.string().max(8).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
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

// Company-scoped since migration 000012 — companyId comes from the session
// (getCompanyId()), never the request body, same convention as every other
// company-scoped write this session.
export const salaryComponentSchema = z.object({
  code: z.string().min(1).max(30),
  name: z.string().min(1).max(100),
  type: z.enum(['earning', 'deduction', 'employer_contribution']),
  includeInGratuity: z.boolean().default(false),
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
