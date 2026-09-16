/**
 * Helpers shared by the matrix admin routes: ISO date → UTC-midnight Date,
 * decimal coercion, and mapping a validated line input to a
 * WorkflowMatrixLine row with the §7.3 defaults.
 */

import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { wfMatrixLineSchema } from '@/lib/validations/platform-workflow';

export type MatrixLineInput = z.infer<typeof wfMatrixLineSchema>;

export function isoToUtcDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function decimalOrNull(v: number | string | null | undefined): Prisma.Decimal | null {
  if (v === null || v === undefined || v === '') return null;
  return new Prisma.Decimal(typeof v === 'number' ? v.toString() : v);
}

export function lineData(matrixId: number, l: MatrixLineInput, index: number): Prisma.WorkflowMatrixLineCreateManyInput {
  return {
    matrixId,
    levelNo: l.levelNo,
    sequence: l.sequence ?? index + 1,
    parallelGroup: l.parallelGroup ?? null,
    approverType: l.approverType,
    approverRef: l.approverRef,
    mandatory: l.mandatory ?? true,
    quorumRule: l.quorumRule ?? 'ALL',
    quorumN: l.quorumN ?? null,
    escalationDays: new Prisma.Decimal((l.escalationDays ?? 2).toFixed(1)),
    escalationTargetType: l.escalationTargetType ?? 'POSITION',
    escalationTargetRef: l.escalationTargetRef ?? (l.escalationTargetType === 'NONE' ? null : 'APPROVER_MANAGER_L1'),
    escalationMode: l.escalationMode ?? 'ADD',
    maxEscalationHops: l.maxEscalationHops ?? 2,
    skipIfSameAsRequester: l.skipIfSameAsRequester ?? true,
    remarkMandatory: l.remarkMandatory ?? false,
  };
}
