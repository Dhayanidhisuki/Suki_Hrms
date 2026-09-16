/**
 * Zod schemas for the Notification & Communication platform service
 * (src/app/api/platform/notification/**). Prefix: ntf*.
 */

import { z } from 'zod';

export const NTF_CHANNELS = ['INAPP', 'EMAIL', 'SMS', 'PUSH'] as const;
export const NTF_CATEGORIES = ['TRANSACTIONAL', 'STATUTORY', 'REMINDER', 'INFORMATIONAL', 'MARKETING_INTERNAL'] as const;
export const NTF_PRIORITIES = ['URGENT', 'NORMAL', 'LOW'] as const;
export const NTF_LANGUAGES = ['en-IN', 'ta-IN', 'hi-IN', 'kn-IN'] as const;
export const NTF_TEMPLATE_STATUSES = ['Draft', 'Active', 'Inactive'] as const;
export const NTF_MODULE_CODES = ['CORE', 'ATTN', 'LEAV', 'PAYR', 'LOAN', 'RECR', 'TRDV', 'ESSV', 'PERF', 'FNFS', 'STAT', 'RPTG', 'PLAT'] as const;

const code = z.string().trim().min(1).max(40).regex(/^[A-Z][A-Z0-9_]*$/, 'Upper-case letters, digits and underscore only');
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD expected');

/** Restricted HTML subset (§12.2): no script, no event handlers, no external resources. */
const restrictedHtml = z
  .string()
  .max(200_000)
  .refine((s) => !/<\s*(script|iframe|object|embed|link|meta|style)\b/i.test(s), 'bodyHtml may not contain script, iframe, object, embed, link, meta or style tags')
  .refine((s) => !/\son[a-z]+\s*=/i.test(s), 'bodyHtml may not contain inline event handlers')
  .refine((s) => !/javascript:/i.test(s), 'bodyHtml may not contain javascript: URLs')
  .refine((s) => !/\bsrc\s*=\s*["']?\s*(https?:)?\/\//i.test(s), 'bodyHtml may not reference external resources');

export const ntfEventCreateSchema = z.object({
  code,
  name: z.string().trim().min(1).max(120),
  moduleCode: z.enum(NTF_MODULE_CODES),
  category: z.enum(NTF_CATEGORIES).default('TRANSACTIONAL'),
  defaultPriority: z.enum(NTF_PRIORITIES).default('NORMAL'),
  defaultRecipients: z.string().trim().max(400).optional().nullable(),
  contextSchemaJson: z.string().max(100_000).optional().nullable(),
  inAppEnabled: z.boolean().default(true),
  emailEnabled: z.boolean().default(true),
  smsEnabled: z.boolean().default(false),
  pushEnabled: z.boolean().default(false),
  quietHoursExempt: z.boolean().optional(),
  digestEligible: z.boolean().optional(),
  retentionDays: z.number().int().min(1).max(10_000).default(2920),
  isActive: z.boolean().default(true),
});

export const ntfEventUpdateSchema = ntfEventCreateSchema.omit({ code: true }).partial();

const templateBase = z.object({
  code,
  name: z.string().trim().min(1).max(120),
  eventCode: code,
  channel: z.enum(NTF_CHANNELS),
  language: z.enum(NTF_LANGUAGES).default('en-IN'),
  effectiveFrom: dateOnly,
  effectiveTo: dateOnly.optional().nullable(),
  subject: z.string().max(300).optional().nullable(),
  bodyHtml: restrictedHtml.optional().nullable(),
  bodyText: z.string().min(1).max(200_000),
  smsText: z.string().max(320).optional().nullable(),
  designationFilter: z.string().trim().max(200).optional().nullable(),
  departmentFilter: z.string().trim().max(200).optional().nullable(),
  status: z.enum(NTF_TEMPLATE_STATUSES).default('Active'),
});

function channelRules(v: { channel: string; subject?: string | null; bodyHtml?: string | null; smsText?: string | null }, ctx: z.RefinementCtx) {
  if ((v.channel === 'EMAIL' || v.channel === 'INAPP') && !v.subject?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['subject'], message: 'subject is mandatory for EMAIL and INAPP templates' });
  }
  if (v.channel === 'SMS' && !v.smsText?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['smsText'], message: 'smsText is mandatory for SMS templates' });
  }
}

export const ntfTemplateCreateSchema = templateBase.superRefine(channelRules);

/** PUT: code/eventCode/channel/language are identity and cannot change. */
export const ntfTemplateUpdateSchema = templateBase
  .omit({ code: true, eventCode: true, channel: true, language: true })
  .partial()
  .extend({ versionNote: z.string().max(200).optional() });

export const ntfPreviewSchema = z
  .object({
    templateId: z.number().int().positive().optional(),
    channel: z.enum(NTF_CHANNELS).optional(),
    subject: z.string().max(300).optional().nullable(),
    bodyText: z.string().max(200_000).optional(),
    bodyHtml: z.string().max(200_000).optional().nullable(),
    smsText: z.string().max(320).optional().nullable(),
    subjectEmpId: z.number().int().positive().optional(),
    requesterEmpId: z.number().int().positive().optional(),
    recipientEmpId: z.number().int().positive().optional(),
    linkPath: z.string().max(500).optional(),
    sampleContext: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  })
  .refine((v) => v.templateId !== undefined || v.bodyText !== undefined, { message: 'templateId or bodyText is required', path: ['bodyText'] });

export const ntfDispatchSchema = z.object({
  limit: z.number().int().min(1).max(1000).optional(),
});

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
};

export const ntfInboxQuerySchema = z.object({
  unread: z.enum(['1', '0', 'true', 'false']).optional(),
  ...pageQuery,
});

export const ntfDeliveryQuerySchema = z.object({
  eventCode: z.string().trim().max(40).optional(),
  status: z.string().trim().max(32).optional(),
  channel: z.enum(NTF_CHANNELS).optional(),
  recipientId: z.coerce.number().int().positive().optional(),
  correlationId: z.string().trim().max(60).optional(),
  ...pageQuery,
});

export const ntfTemplateQuerySchema = z.object({
  eventCode: z.string().trim().max(40).optional(),
  channel: z.enum(NTF_CHANNELS).optional(),
  status: z.enum(NTF_TEMPLATE_STATUSES).optional(),
  /** default: only the latest version per code */
  allVersions: z.enum(['1', '0', 'true', 'false']).optional(),
});

export type NtfEventCreate = z.infer<typeof ntfEventCreateSchema>;
export type NtfTemplateCreate = z.infer<typeof ntfTemplateCreateSchema>;
export type NtfTemplateUpdate = z.infer<typeof ntfTemplateUpdateSchema>;
export type NtfPreview = z.infer<typeof ntfPreviewSchema>;
