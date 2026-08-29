/**
 * Employee Activity timeline helper. Call inside the same Prisma transaction
 * as the mutation it's recording, so the activity row and the change it
 * describes commit or roll back together.
 *
 * Never pass full sensitive KYC/bank values or passwords as oldValue/newValue —
 * callers touching those tables must mask/omit them before calling this.
 */

import type { Prisma } from '@prisma/client';

export interface LogActivityInput {
  employeeId: number;
  activityType: string;
  module: string;
  performedByUserId?: number | null;
  oldValue?: unknown;
  newValue?: unknown;
  remarks?: string;
  source?: string;
  relatedRecordId?: number;
}

function toStoredValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return str.length > 2000 ? str.slice(0, 2000) : str;
}

export async function logActivity(
  tx: Prisma.TransactionClient,
  input: LogActivityInput
): Promise<void> {
  await tx.employeeActivity.create({
    data: {
      employeeId: input.employeeId,
      activityType: input.activityType,
      module: input.module,
      performedByUserId: input.performedByUserId ?? null,
      oldValue: toStoredValue(input.oldValue),
      newValue: toStoredValue(input.newValue),
      remarks: input.remarks ?? null,
      source: input.source ?? 'web',
      relatedRecordId: input.relatedRecordId ?? null,
    },
  });
}
