/**
 * Zod schemas for Announcements (employee-portal circulars).
 *
 * `status` is deliberately absent from both schemas: an announcement moves
 * DRAFT → PUBLISHED → ARCHIVED through its own endpoints, never by a client
 * posting a status string.
 */

import { z } from 'zod';

export const ANNOUNCEMENT_CATEGORIES = ['POLICY', 'CIRCULAR', 'GENERAL'] as const;
export const ANNOUNCEMENT_PRIORITIES = ['NORMAL', 'IMPORTANT'] as const;
export const ANNOUNCEMENT_AUDIENCE_SCOPES = ['DEPARTMENT', 'SUB_DEPARTMENT', 'DESIGNATION', 'EMPLOYEE_TYPE', 'UNIT'] as const;

const announcementBaseObject = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1),
  category: z.enum(ANNOUNCEMENT_CATEGORIES).default('GENERAL'),
  priority: z.enum(ANNOUNCEMENT_PRIORITIES).default('NORMAL'),
  // ISO date-time; null clears an existing expiry.
  expiresAt: z.string().datetime().nullable().optional(),
  // null/omitted = every active employee of the company (today's behavior).
  audienceScopeType: z.enum(ANNOUNCEMENT_AUDIENCE_SCOPES).nullable().optional(),
  // Master `code` values the scope targets; required (non-empty) whenever
  // audienceScopeType is set.
  audienceScopeValues: z.array(z.string().trim().min(1)).optional(),
});

const audienceRefine = (data: { audienceScopeType?: string | null; audienceScopeValues?: string[] }) =>
  !data.audienceScopeType || (data.audienceScopeValues != null && data.audienceScopeValues.length > 0);
const audienceRefineOpts = {
  message: 'Select at least one value for the chosen audience scope',
  path: ['audienceScopeValues'] as PropertyKey[],
};

export const announcementCreateSchema = announcementBaseObject.refine(audienceRefine, audienceRefineOpts);
export const announcementUpdateSchema = announcementBaseObject.partial().refine(audienceRefine, audienceRefineOpts);
