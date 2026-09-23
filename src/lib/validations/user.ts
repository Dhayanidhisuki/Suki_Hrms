/**
 * Zod validation schemas for the User master (Administration > User & Access).
 */

import { z } from 'zod';

export const userCreateSchema = z.object({
  email: z.string().email().max(100),
  password: z.string().min(6).max(72),
  roleId: z.number().int().positive(),
  isActive: z.boolean().default(true),
  // Optional — links this account to an Employee (Admin > Users > Add
  // User's Employee ID picker). The server derives loginId from the
  // employee's own employeeCode; it never trusts a client-supplied loginId.
  employeeId: z.coerce.number().int().positive().optional(),
});

export const userUpdateSchema = z.object({
  email: z.string().email().max(100),
  roleId: z.number().int().positive(),
  isActive: z.boolean().default(true),
  // Non-empty only when the caller wants to change the password.
  password: z.string().min(6).max(72).optional().or(z.literal('')),
});
