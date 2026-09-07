/**
 * Zod validation schemas for Gratuity Phase 1.
 */

import { z } from 'zod';

export const calculateGratuitySchema = z.object({
  employeeId: z.number().int().positive(),
});

export const rejectGratuitySchema = z.object({
  rejectReason: z.string().min(1).max(500),
});

export const holdGratuitySchema = z.object({
  holdReason: z.string().min(1).max(500),
});

export const markGratuityPaidSchema = z.object({
  paymentDate: z.coerce.date(),
  paymentReference: z.string().min(1).max(100),
});
