/**
 * Zod validation schema for the Role master (Administration > User & Access).
 * Same shape as the simple masters (code + name + description + isActive).
 */

import { z } from 'zod';

export const roleSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const rolePermissionsSchema = z.object({
  permissionIds: z.array(z.number().int().positive()),
});
