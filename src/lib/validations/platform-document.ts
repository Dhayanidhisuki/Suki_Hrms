/**
 * zod schemas for the Document service routes (/api/platform/document/**).
 * Prefix: pdoc.
 */

import { z } from 'zod';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CLASSES,
  OWNER_ENTITY_TYPES,
  REJECTION_REASON_CODES,
} from '@/lib/platform/document/rules';

const csvList = z.string().max(200).nullable().optional();

const pdocTypeBase = z.object({
  code: z.string().trim().min(2).max(30).regex(/^[A-Z0-9_]+$/, 'Upper-case letters, digits and underscore only'),
  name: z.string().trim().min(1).max(120),
  category: z.enum(DOCUMENT_CATEGORIES),
  appliesToEntity: z.enum(OWNER_ENTITY_TYPES),
  documentClass: z.enum(DOCUMENT_CLASSES).default('INTERNAL'),
  mandatoryFlag: z.boolean().default(false),
  mandatoryFromStage: z.string().trim().max(30).nullable().optional(),
  applicableDepartment: csvList,
  applicableDesignation: csvList,
  applicableGrade: csvList,
  applicableEmploymentType: csvList,
  applicableLocation: csvList,
  verificationRequired: z.boolean().default(true),
  verifierRole: z.string().trim().max(30).nullable().optional(),
  expiryRequired: z.boolean().default(false),
  expiryAlertOffsets: z.string().trim().max(60).regex(/^(\d+\s*,\s*)*\d+$/).nullable().optional(),
  allowedFileTypes: z.string().trim().min(1).max(100).default('pdf,jpg,png'),
  maxFileSizeMb: z.number().int().min(1).max(25).default(5),
  maxFileCount: z.number().int().min(1).max(20).default(1),
  retentionYears: z.number().int().min(0).max(100).default(8),
  isActive: z.boolean().default(true),
});

export const pdocTypeCreateSchema = pdocTypeBase.superRefine((v, ctx) => {
  if (v.verificationRequired && !v.verifierRole) {
    ctx.addIssue({ code: 'custom', path: ['verifierRole'], message: 'verifierRole is required when verificationRequired is true' });
  }
});

export const pdocTypeUpdateSchema = pdocTypeBase.omit({ code: true }).partial();

export const pdocOwnerQuerySchema = z.object({
  ownerEntityType: z.enum(OWNER_ENTITY_TYPES),
  ownerEntityId: z.coerce.number().int().positive(),
});

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .transform((s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  })
  .refine((d) => !Number.isNaN(d.getTime()), 'Invalid date');

/** Text fields of the multipart upload; the file itself is validated by the service. */
export const pdocUploadFieldsSchema = z.object({
  documentTypeCode: z.string().trim().min(1).max(30),
  ownerEntityType: z.enum(OWNER_ENTITY_TYPES),
  ownerEntityId: z.coerce.number().int().positive(),
  issueDate: isoDate.optional(),
  expiryDate: isoDate.optional(),
  identifier: z.string().trim().min(1).max(40).optional(),
});

export const pdocVerifySchema = z.object({
  remark: z.string().trim().max(500).optional(),
});

export const pdocRejectSchema = z.object({
  reasonCode: z.enum(REJECTION_REASON_CODES),
  remark: z.string().trim().min(10).max(500),
});

export const pdocRevokeSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const pdocCompletenessQuerySchema = pdocOwnerQuerySchema.extend({
  stage: z.string().trim().max(30).optional(),
});

export const pdocExpirySweepSchema = z.object({
  today: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
