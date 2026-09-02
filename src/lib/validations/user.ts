/**
 * Zod validation schemas for the User master (Administration > User & Access).
 */

import { z } from 'zod';

export const userCreateSchema = z.object({
  email: z.string().email().max(100),
  password: z.string().min(6).max(72),
  roleId: z.number().int().positive(),
  isActive: z.boolean().default(true),
});

export const userUpdateSchema = z.object({
  email: z.string().email().max(100),
  roleId: z.number().int().positive(),
  isActive: z.boolean().default(true),
  // Non-empty only when the caller wants to change the password.
  password: z.string().min(6).max(72).optional().or(z.literal('')),
});
