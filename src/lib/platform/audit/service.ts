/**
 * Audit Trail service (BRD Part 20). Append-only: there is no update or
 * delete function here and none should be added. A failure to write an
 * audit row is logged and swallowed so it can never roll back the business
 * transaction it describes — but it is always awaited, never fire-and-forget,
 * so the row exists by the time the caller responds.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { PlatformActor } from '../contracts';

type Db = Prisma.TransactionClient | typeof prisma;

export type AuditInput = {
  companyId: number | null;
  entityType: string;
  entityId?: number | null;
  entityRef?: string | null;
  action: string;
  actor: PlatformActor;
  before?: unknown;
  after?: unknown;
  remark?: string | null;
  correlationId?: string | null;
};

const MAX_REMARK = 1000;
const MAX_CHANGED = 1000;

function toJson(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  try {
    return JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? val.toString() : val));
  } catch {
    return null;
  }
}

/** Shallow diff of top-level keys; enough to answer "what changed" at a glance. */
export function changedFieldsOf(before: unknown, after: unknown): string[] {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return [];
  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: string[] = [];
  for (const k of keys) {
    if (toJson(a[k]) !== toJson(b[k])) out.push(k);
  }
  return out.sort();
}

export async function audit(input: AuditInput, db: Db = prisma): Promise<number | null> {
  const changed = changedFieldsOf(input.before, input.after).join(',');
  try {
    const row = await db.auditLog.create({
      data: {
        companyId: input.companyId,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        entityRef: input.entityRef ?? null,
        action: input.action,
        actorUserId: input.actor.userId ?? null,
        actorEmpId: input.actor.employeeId ?? null,
        actorSource: input.actor.source ?? 'user',
        onBehalfOfEmpId: input.actor.onBehalfOfEmployeeId ?? null,
        beforeJson: toJson(input.before),
        afterJson: toJson(input.after),
        changedFields: changed ? changed.slice(0, MAX_CHANGED) : null,
        remark: input.remark ? input.remark.slice(0, MAX_REMARK) : null,
        correlationId: input.correlationId ?? null,
        ipAddress: input.actor.ipAddress ?? null,
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    console.error('[platform/audit] write failed:', err);
    return null;
  }
}

export async function readAudit(params: {
  companyId: number;
  entityType: string;
  entityId?: number;
  limit?: number;
  before?: Date;
}) {
  return prisma.auditLog.findMany({
    where: {
      companyId: params.companyId,
      entityType: params.entityType,
      ...(params.entityId !== undefined ? { entityId: params.entityId } : {}),
      ...(params.before ? { createdAt: { lt: params.before } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(params.limit ?? 50, 500),
  });
}
