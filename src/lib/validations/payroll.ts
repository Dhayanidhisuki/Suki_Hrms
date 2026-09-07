/**
 * Zod validation schemas for Payroll Processing Phase 1.
 */

import { z } from 'zod';

export const createPayrollRunSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export const adhocComponentSchema = z.object({
  salaryComponentId: z.number().int().positive(),
  amount: z.number(), // sign follows the component's own earning/deduction type
});

// ─── Salary Revision & Arrear — Phase 1 ────────────────────────────────────

export const createSalaryRevisionRequestSchema = z
  .object({
    employeeId: z.number().int().positive(),
    revisionType: z.enum(['ANNUAL_INCREMENT', 'PROMOTION', 'SPECIAL']),
    revisionMethod: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'REVISED_GROSS']),
    incrementPercent: z.coerce.number().optional(),
    incrementAmount: z.coerce.number().optional(),
    revisedGross: z.coerce.number().positive().optional(),
    effectiveFrom: z.coerce.date(),
    remarks: z.string().max(500).optional().nullable(),
    components: z
      .array(
        z.object({
          salaryComponentId: z.number().int().positive(),
          revisedAmount: z.coerce.number().nonnegative(),
        })
      )
      .default([]),
    submit: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.revisionMethod === 'PERCENTAGE' && data.incrementPercent === undefined) {
      ctx.addIssue({ code: 'custom', message: 'incrementPercent is required for PERCENTAGE method', path: ['incrementPercent'] });
    }
    if (data.revisionMethod === 'FIXED_AMOUNT' && data.incrementAmount === undefined) {
      ctx.addIssue({ code: 'custom', message: 'incrementAmount is required for FIXED_AMOUNT method', path: ['incrementAmount'] });
    }
    if (data.revisionMethod === 'REVISED_GROSS' && data.revisedGross === undefined) {
      ctx.addIssue({ code: 'custom', message: 'revisedGross is required for REVISED_GROSS method', path: ['revisedGross'] });
    }
  });

export const rejectRevisionSchema = z.object({
  rejectReason: z.string().min(1).max(500),
});

export const holdRevisionSchema = z.object({
  holdReason: z.string().min(1).max(500),
});

export const applyArrearSchema = z.object({
  payrollRunId: z.number().int().positive(),
});
