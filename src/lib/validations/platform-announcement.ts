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

export const announcementCreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1),
  category: z.enum(ANNOUNCEMENT_CATEGORIES).default('GENERAL'),
  priority: z.enum(ANNOUNCEMENT_PRIORITIES).default('NORMAL'),
  // ISO date-time; null clears an existing expiry.
  expiresAt: z.string().datetime().nullable().optional(),
});

export const announcementUpdateSchema = announcementCreateSchema.partial();
