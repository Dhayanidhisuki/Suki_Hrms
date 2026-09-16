/**
 * zod schemas for the platform workflow / snapshot / audit API routes.
 * All exports are prefixed wf* (workflow), snp* (snapshot), aud* (audit).
 */

import { z } from 'zod';

const MODULE_CODES = ['CORE', 'ATTN', 'LEAV', 'PAYR', 'LOAN', 'RECR', 'TRDV', 'ESSV', 'PERF', 'FNFS', 'STAT', 'RPTG', 'PLAT'] as const;

const code = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[A-Za-z0-9_.:-]+$/, 'letters, digits, _ . : - only');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

const decimalString = z.union([z.number().finite(), z.string().trim().regex(/^-?\d+(\.\d+)?$/, 'decimal')]);

const jsonValue: z.ZodType<unknown> = z.unknown();

// ─── request types ───────────────────────────────────────────────────────────

export const wfRequestTypeSchema = z.object({
  code: code(30),
  name: z.string().trim().min(1).max(120),
  moduleCode: z.enum(MODULE_CODES),
  handlerKey: z.string().trim().max(60).nullable().optional(),
  conditionFieldsUsed: z.string().trim().max(200).nullable().optional(),
  allowReturn: z.boolean().optional(),
  allowCancelAfterSubmit: z.boolean().optional(),
  allowBulkApproval: z.boolean().optional(),
  allowDelegation: z.boolean().optional(),
  autoApproveOnExhaustion: z.boolean().optional(),
  remarkMandatoryOnApprove: z.boolean().optional(),
  snapshotTypeCode: code(30).nullable().optional(),
  retentionYears: z.number().int().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
});
export const wfRequestTypeUpdateSchema = wfRequestTypeSchema.partial().omit({ code: true });

// ─── matrices ────────────────────────────────────────────────────────────────

export const wfMatrixLineSchema = z
  .object({
    levelNo: z.number().int().min(1).max(20),
    sequence: z.number().int().min(1).max(50).optional(),
    parallelGroup: z.number().int().min(1).max(50).nullable().optional(),
    approverType: z.enum(['EMPLOYEE', 'ROLE', 'POSITION']),
    approverRef: z.string().trim().min(1).max(60),
    mandatory: z.boolean().optional(),
    quorumRule: z.enum(['ALL', 'ANY', 'N_OF_M']).optional(),
    quorumN: z.number().int().min(1).max(50).nullable().optional(),
    escalationDays: z.number().min(0).max(999.9).optional(),
    escalationTargetType: z.enum(['POSITION', 'ROLE', 'EMPLOYEE', 'NONE']).optional(),
    escalationTargetRef: z.string().trim().max(60).nullable().optional(),
    escalationMode: z.enum(['ADD', 'REPLACE']).optional(),
    maxEscalationHops: z.number().int().min(0).max(10).optional(),
    skipIfSameAsRequester: z.boolean().optional(),
    remarkMandatory: z.boolean().optional(),
  })
  .refine((l) => l.quorumRule !== 'N_OF_M' || (l.quorumN ?? 0) >= 1, { message: 'quorumN is required for N_OF_M', path: ['quorumN'] });

export const wfMatrixLinesSchema = z.object({ lines: z.array(wfMatrixLineSchema).min(1).max(200) });

const matrixHeaderFields = {
  name: z.string().trim().min(1).max(120),
  effectiveFrom: isoDate.optional(),
  effectiveTo: isoDate.nullable().optional(),
  isFallback: z.boolean().optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  minAmount: decimalString.nullable().optional(),
  maxAmount: decimalString.nullable().optional(),
  designationCodes: z.string().trim().max(400).nullable().optional(),
  departmentCodes: z.string().trim().max(400).nullable().optional(),
  gradeCodes: z.string().trim().max(400).nullable().optional(),
  employmentType: z.string().trim().max(20).nullable().optional(),
  locationCode: z.string().trim().max(30).nullable().optional(),
  costCentreCode: z.string().trim().max(30).nullable().optional(),
  requestSubType: z.string().trim().max(30).nullable().optional(),
};

export const wfMatrixCreateSchema = z.object({
  code: code(30),
  requestTypeCode: code(30),
  ...matrixHeaderFields,
  lines: z.array(wfMatrixLineSchema).max(200).optional(),
});

/** PUT /matrices/[id] — creates a new version; every field optional, lines optional (copied if absent). */
export const wfMatrixVersionSchema = z.object({
  ...Object.fromEntries(Object.entries(matrixHeaderFields).map(([k, v]) => [k, v.optional()])),
  lines: z.array(wfMatrixLineSchema).max(200).optional(),
}) as z.ZodObject<{ [K in keyof typeof matrixHeaderFields]: z.ZodOptional<(typeof matrixHeaderFields)[K]> } & { lines: z.ZodOptional<z.ZodArray<typeof wfMatrixLineSchema>> }>;

// ─── requests ────────────────────────────────────────────────────────────────

export const wfCreateDraftSchema = z.object({
  requestTypeCode: code(30),
  sourceEntityType: z.string().trim().min(1).max(40),
  sourceEntityId: z.number().int().min(0),
  title: z.string().trim().min(1).max(200),
  requesterEmpId: z.number().int().positive().optional(),
  subjectEmpId: z.number().int().positive().nullable().optional(),
  onBehalfOfEmpId: z.number().int().positive().nullable().optional(),
  amount: decimalString.nullable().optional(),
  requestSubType: z.string().trim().max(30).nullable().optional(),
  priority: z.enum(['URGENT', 'NORMAL', 'LOW']).optional(),
  payload: jsonValue.optional(),
});

export const wfUpdateDraftSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  subjectEmpId: z.number().int().positive().nullable().optional(),
  amount: decimalString.nullable().optional(),
  requestSubType: z.string().trim().max(30).nullable().optional(),
  priority: z.enum(['URGENT', 'NORMAL', 'LOW']).optional(),
  payload: jsonValue.optional(),
});

export const wfApproveSchema = z.object({ remark: z.string().trim().max(500).optional() });
export const wfReasonSchema = z.object({ reason: z.string().trim().min(1).max(1000) });
export const wfRejectSchema = z.object({ reason: z.string().trim().min(10, 'Rejection reason must be at least 10 characters').max(1000) });
export const wfCancelSchema = z.object({ reason: z.string().trim().max(1000).optional() });
export const wfResubmitSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  amount: decimalString.nullable().optional(),
  requestSubType: z.string().trim().max(30).nullable().optional(),
  payload: jsonValue.optional(),
});

export const wfListQuerySchema = z.object({
  status: z.string().trim().max(24).optional(),
  requestTypeCode: z.string().trim().max(30).optional(),
  moduleCode: z.string().trim().max(4).optional(),
  requesterEmpId: z.coerce.number().int().positive().optional(),
  subjectEmpId: z.coerce.number().int().positive().optional(),
  sourceEntityType: z.string().trim().max(40).optional(),
  sourceEntityId: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const wfInboxQuerySchema = z.object({
  status: z.string().trim().max(24).optional(),
  requestTypeCode: z.string().trim().max(30).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  mine: z.string().optional(),
});

// ─── delegations ─────────────────────────────────────────────────────────────

export const wfDelegationSchema = z
  .object({
    delegatorEmpId: z.number().int().positive().optional(),
    delegateEmpId: z.number().int().positive(),
    scopeType: z.enum(['ALL', 'MODULE', 'REQUEST_TYPE']).optional(),
    scopeRefList: z.string().trim().max(400).nullable().optional(),
    fromDate: isoDate,
    toDate: isoDate,
    amountCeiling: decimalString.nullable().optional(),
    reasonCode: z.enum(['LEAVE', 'TRAVEL', 'MEDICAL', 'TRAINING', 'TEMPORARY_CHARGE', 'TEMPORARY_ROLE', 'OTHER']),
    reasonText: z.string().trim().max(500).nullable().optional(),
    includeInFlight: z.boolean().optional(),
    notifyDelegator: z.boolean().optional(),
  })
  .refine((d) => d.toDate >= d.fromDate, { message: 'toDate must be on or after fromDate', path: ['toDate'] })
  .refine((d) => d.reasonCode !== 'OTHER' || (d.reasonText ?? '').trim().length > 0, { message: 'reasonText is mandatory when reasonCode is OTHER', path: ['reasonText'] })
  .refine((d) => (d.scopeType ?? 'ALL') === 'ALL' || (d.scopeRefList ?? '').trim().length > 0, { message: 'scopeRefList is required for MODULE / REQUEST_TYPE scope', path: ['scopeRefList'] });

export const wfDelegationListQuerySchema = z.object({
  status: z.string().trim().max(12).optional(),
  delegatorEmpId: z.coerce.number().int().positive().optional(),
  delegateEmpId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

// ─── audit ───────────────────────────────────────────────────────────────────

export const audQuerySchema = z.object({
  entityType: z.string().trim().min(1).max(60),
  entityId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  before: z.string().datetime({ offset: true }).optional(),
});
