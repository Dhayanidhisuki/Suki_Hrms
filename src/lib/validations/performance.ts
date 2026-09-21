/**
 * Zod schemas for the KPI/KRA Performance Management module.
 * BRD §7 (cycle), §8 (KRA master), §9 (KPI master), §17 (goal setting), §41.
 */

import { z } from 'zod';
import { MEASUREMENT_FREQUENCIES, MEASUREMENT_TYPES } from '@/lib/performance/measurement';

const code = z.string().trim().min(1).max(30).transform((s) => s.toUpperCase());
const status = z.enum(['ACTIVE', 'INACTIVE']);
const weightage = z.coerce.number().min(0).max(100);
const optionalId = z.coerce.number().int().positive().nullish();
const dateOnly = z.coerce.date();

// ── BRD §7. Performance cycle ────────────────────────────────────────────────
export const performanceCycleSchema = z
  .object({
    code,
    name: z.string().trim().min(1).max(150),
    cycleType: z.enum(['ANNUAL', 'HALF_YEARLY', 'QUARTERLY']).default('ANNUAL'),
    startDate: dateOnly,
    endDate: dateOnly,
    goalSettingStart: dateOnly,
    goalSettingEnd: dateOnly,
    status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).default('DRAFT'),
  })
  .refine((v) => v.endDate > v.startDate, { message: 'End date must be after start date', path: ['endDate'] })
  .refine((v) => v.goalSettingEnd >= v.goalSettingStart, {
    message: 'Goal setting end must be on or after goal setting start',
    path: ['goalSettingEnd'],
  })
  .refine((v) => v.goalSettingStart >= v.startDate && v.goalSettingEnd <= v.endDate, {
    message: 'Goal setting window must fall inside the cycle',
    path: ['goalSettingStart'],
  });

// ── BRD §8. KRA master ───────────────────────────────────────────────────────
export const kraSchema = z
  .object({
    code,
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().min(1).max(1000),
    departmentId: optionalId,
    designationId: optionalId,
    jobRole: z.string().trim().max(100).nullish(),
    category: z.string().trim().min(1).max(50),
    defaultWeightage: weightage.nullish(),
    status: status.default('ACTIVE'),
    effectiveFrom: dateOnly,
    effectiveTo: dateOnly.nullish(),
  })
  .refine((v) => !v.effectiveTo || v.effectiveTo >= v.effectiveFrom, {
    message: 'Effective To must be on or after Effective From',
    path: ['effectiveTo'],
  });

// ── BRD §9. KPI master ───────────────────────────────────────────────────────
export const kpiSchema = z
  .object({
    code,
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().min(1).max(1000),
    kraId: z.coerce.number().int().positive(),
    measurementType: z.enum(MEASUREMENT_TYPES),
    unit: z.string().trim().min(1).max(30),
    target: z.coerce.number(),
    minThreshold: z.coerce.number().nullish(),
    maxTarget: z.coerce.number().nullish(),
    weightage,
    frequency: z.enum(MEASUREMENT_FREQUENCIES),
    dataSource: z.string().trim().max(150).nullish(),
    status: status.default('ACTIVE'),
  })
  .refine((v) => v.minThreshold == null || v.maxTarget == null || v.maxTarget >= v.minThreshold, {
    message: 'Maximum target must be at or above the minimum threshold',
    path: ['maxTarget'],
  });

// ── Goal templates ───────────────────────────────────────────────────────────
const templateKpiLine = z.object({
  kpiId: z.coerce.number().int().positive(),
  target: z.coerce.number(),
  weightage,
  minThreshold: z.coerce.number().nullish(),
  maxTarget: z.coerce.number().nullish(),
});

const templateKraLine = z.object({
  kraId: z.coerce.number().int().positive(),
  weightage,
  kpis: z.array(templateKpiLine).min(1),
});

export const goalTemplateSchema = z.object({
  code: code.optional(),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).nullish(),
  departmentId: optionalId,
  designationId: optionalId,
  jobRole: z.string().trim().max(100).nullish(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']).default('DRAFT'),
  kras: z.array(templateKraLine).min(1),
});

export const goalTemplateStatusSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']),
});

export const bulkAssignSchema = z.object({
  cycleId: z.coerce.number().int().positive(),
  templateId: z.coerce.number().int().positive(),
  employeeIds: z.array(z.coerce.number().int().positive()).min(1),
});

// ── BRD §17. Goal assignment ─────────────────────────────────────────────────
/**
 * BRD §41 mandatory fields: a KPI cannot be saved without name, measurement
 * type, target, weightage, start date and end date. Name and measurement type
 * come from the KPI master via kpiId; the rest are required here.
 */
const goalKpiLine = z.object({
  kpiId: z.coerce.number().int().positive(),
  description: z.string().trim().min(1).max(1000),
  measurementType: z.enum(MEASUREMENT_TYPES),
  unit: z.string().trim().min(1).max(30),
  target: z.coerce.number(),
  minThreshold: z.coerce.number().nullish(),
  maxTarget: z.coerce.number().nullish(),
  weightage,
  startDate: dateOnly,
  endDate: dateOnly,
  frequency: z.enum(MEASUREMENT_FREQUENCIES),
  evidenceRequired: z.coerce.boolean().default(false),
  employeeComments: z.string().trim().max(1000).nullish(),
  managerComments: z.string().trim().max(1000).nullish(),
});

const goalKraLine = z.object({
  kraId: z.coerce.number().int().positive(),
  weightage,
  kpis: z.array(goalKpiLine).min(1),
});

export const createGoalSetSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  cycleId: z.coerce.number().int().positive(),
});

export const saveGoalSetSchema = z.object({
  kras: z.array(goalKraLine).min(1),
});

export const applyTemplateSchema = z.object({
  templateId: z.coerce.number().int().positive(),
  /** Replace whatever is on the set; the BRD has no merge semantics. */
  replaceExisting: z.coerce.boolean().default(true),
});

export const acceptGoalSetSchema = z.object({
  action: z.enum(['ACCEPT', 'RETURN']),
  employeeRemark: z.string().trim().max(1000).nullish(),
});

export type GoalKraLine = z.infer<typeof goalKraLine>;
export type TemplateKraLine = z.infer<typeof templateKraLine>;
