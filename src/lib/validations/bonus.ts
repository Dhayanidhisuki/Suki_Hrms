/**
 * Zod validation schemas for Bonus Management Phase 1.
 */

import { z } from 'zod';

export const calculateBonusSchema = z.object({
  acYear: z.number().int().min(2000).max(2100),
});

export const rejectBonusSchema = z.object({
  rejectReason: z.string().min(1).max(500),
});

export const holdBonusSchema = z.object({
  holdReason: z.string().min(1).max(500),
});

export const applyBonusSchema = z.object({
  payrollRunId: z.number().int().positive(),
});

// 8.33% is a hard floor on any bonus rate — the company's own BonusRate
// (see bonusRateSchema, src/lib/validations/master.ts) and this per-record
// override alike. The upper bound is the record's own BonusRate.maxRatePercent
// — not static, checked against the fetched row in the route handler.
export const editBonusPercentSchema = z.object({
  bonusPercent: z.number().min(8.33),
});
