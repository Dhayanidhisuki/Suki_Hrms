/**
 * Zod schemas for the Employee Master / Core HR tranche (BRD 01):
 * org-hierarchy masters (§5), employee code policy (§7), lifecycle
 * transitions (§8), the Recruitment handoff payload (§9), dated job changes
 * (§15/§18/§19) and data-scope assignments (§20).
 */

import { z } from 'zod';

/** Empty string / null / undefined → null; anything else coerced to a positive int. */
const optionalId = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z.coerce.number().int().positive().nullable()
);

const optionalText = (max: number) =>
  z.preprocess((v) => (v === '' ? null : v), z.string().max(max).nullable().optional());

const codeField = z.string().trim().min(1).max(20);

// ─── §5 Org hierarchy masters ────────────────────────────────────────────────

export const businessUnitSchema = z.object({
  code: codeField,
  name: z.string().trim().min(1).max(100),
  headEmpId: optionalId.optional(),
  description: optionalText(500),
  isActive: z.boolean().default(true),
});

export const LOCATION_TYPES = ['PLANT', 'BRANCH', 'CORPORATE_OFFICE', 'WAREHOUSE'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const locationSchema = z.object({
  code: codeField,
  name: z.string().trim().min(1).max(100),
  siteId: optionalId.optional(),
  locationType: z.preprocess((v) => (v === '' || v === null || v === undefined ? 'PLANT' : v), z.enum(LOCATION_TYPES)),
  address: optionalText(500),
  description: optionalText(500),
  isActive: z.boolean().default(true),
});

export const costCentreSchema = z.object({
  code: codeField,
  name: z.string().trim().min(1).max(100),
  departmentId: optionalId.optional(),
  ownerEmpId: optionalId.optional(),
  description: optionalText(500),
  isActive: z.boolean().default(true),
});

/** Accepted alongside the existing unitSchema / siteSchema on the extended routes. */
export const unitHierarchyExtension = z.object({ businessUnitId: optionalId.optional() });
export const siteHierarchyExtension = z.object({ unitId: optionalId.optional() });

// ─── §7 Employee code policy ─────────────────────────────────────────────────

export const employeeCodePolicySchema = z.object({
  prefix: z.string().trim().min(1).max(5).regex(/^[A-Za-z]+$/, 'Prefix must be letters only'),
  width: z.number().int().min(1).max(8),
  nextSequence: z.number().int().min(1).optional(),
});

// ─── §8 Lifecycle ────────────────────────────────────────────────────────────

export const LIFECYCLE_STATES = [
  'DRAFT',
  'CANDIDATE_CONVERTED',
  'PROBATION',
  'CONFIRMED',
  'ON_NOTICE',
  'SUSPENDED',
  'LONG_LEAVE',
  'SEPARATED',
  'REHIRED',
] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export const lifecycleTransitionSchema = z.object({
  toState: z.enum(LIFECYCLE_STATES),
  trigger: z.string().trim().max(40).optional(),
  effectiveDate: z.coerce.date().optional(),
  reason: optionalText(500),
  referenceNo: optionalText(60),
  /** SEPARATED → REHIRED is transient (§8.1); the same transaction lands here. */
  rehireTo: z.enum(['PROBATION', 'CONFIRMED']).optional(),
});

// ─── §15 / §18 / §19 Dated job change ────────────────────────────────────────

export const JOB_CHANGE_REASONS = [
  'JOINING',
  'TRANSFER',
  'PROMOTION',
  'DESIGNATION_CHANGE',
  'DEPARTMENT_CHANGE',
  'EMPLOYEE_TYPE_CHANGE',
  'CONFIRMATION',
  'REPORTING_CHANGE',
  'CORRECTION',
  'POLICY',
  'DEMOTION',
  'REHIRE',
] as const;
export type JobChangeReason = (typeof JOB_CHANGE_REASONS)[number];

export const jobChangeSchema = z.object({
  effectiveFrom: z.coerce.date(),
  changeReason: z.enum(JOB_CHANGE_REASONS),
  changeReference: optionalText(60),
  departmentId: optionalId.optional(),
  subDepartmentId: optionalId.optional(),
  designationId: optionalId.optional(),
  gradeId: optionalId.optional(),
  levelId: optionalId.optional(),
  employeeTypeId: optionalId.optional(),
  categoryId: optionalId.optional(),
  unitId: optionalId.optional(),
  locationId: optionalId.optional(),
  costCentreId: optionalId.optional(),
  noticePeriodDays: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(0).max(365).nullable()
  ).optional(),
  reportingManagerId: optionalId.optional(),
  secondReportingManagerId: optionalId.optional(),
  remarks: optionalText(500),
});

// ─── §9 Recruitment handoff ──────────────────────────────────────────────────

const addressSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: optionalText(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  pinCode: z.string().trim().regex(/^\d{6}$/, 'PIN code must be 6 digits'),
});

export const fromCandidateSchema = z.object({
  sourceApplicationNo: z.string().trim().min(1).max(60),
  offerNo: z.string().trim().min(1).max(50),
  firstName: z.string().trim().min(1).max(100),
  middleName: optionalText(100),
  lastName: z.string().trim().min(1).max(100),
  dateOfBirth: z.coerce.date(),
  gender: z.string().trim().min(1).max(20),
  mobile: z.string().trim().regex(/^[0-9+\-\s]{10,20}$/, 'Invalid mobile number'),
  personalEmail: z.string().trim().email().max(100),
  permanentAddress: addressSchema,
  presentAddress: addressSchema.optional(),
  pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format'),
  aadhaar: z.string().trim().regex(/^\d{12}$/, 'Aadhaar must be 12 digits'),
  personUid: optionalText(40),
  departmentCode: codeField,
  designationCode: codeField,
  gradeCode: codeField,
  levelCode: optionalText(20),
  locationCode: optionalText(20),
  costCentreCode: optionalText(20),
  employeeTypeCode: codeField,
  reportingManagerCode: codeField,
  dateOfJoining: z.coerce.date(),
  probationMonths: z.number().int().min(0).max(60).optional(),
  noticePeriodDays: z.number().int().min(0).max(365).optional(),
  annualCtc: z.number().nonnegative(),
  /** §7.4 — HR Admin confirmed a rehire match; without it a match returns 409 with the candidate. */
  confirmRehire: z.boolean().optional(),
  /** §7.4 — HR Admin only; requires a remark. */
  continuityOfService: z.boolean().optional(),
  remark: optionalText(500),
});
export type FromCandidatePayload = z.infer<typeof fromCandidateSchema>;

// ─── §20 Data scope ──────────────────────────────────────────────────────────

export const SCOPE_TYPES = [
  'GLOBAL',
  'COMPANY',
  'BUSINESS_UNIT',
  'UNIT',
  'SITE',
  'LOCATION',
  'DEPARTMENT',
  'SUB_DEPARTMENT',
  'COST_CENTRE',
  'REPORTING_TREE',
  'EMPLOYEE_LIST',
] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];

export const userScopeSchema = z
  .object({
    userId: z.coerce.number().int().positive(),
    scopeType: z.enum(SCOPE_TYPES),
    scopeValues: z.array(z.string().trim().min(1).max(40)).max(200).optional(),
    treeDepth: z.enum(['DIRECT', 'ALL']).optional(),
  })
  .superRefine((v, ctx) => {
    const needsValues = !['GLOBAL', 'COMPANY', 'REPORTING_TREE'].includes(v.scopeType);
    if (needsValues && (!v.scopeValues || v.scopeValues.length === 0)) {
      ctx.addIssue({ code: 'custom', path: ['scopeValues'], message: 'At least one value is required for this scope type' });
    }
    if (v.scopeType === 'REPORTING_TREE' && !v.treeDepth) {
      ctx.addIssue({ code: 'custom', path: ['treeDepth'], message: 'treeDepth (DIRECT | ALL) is required for REPORTING_TREE' });
    }
  });
