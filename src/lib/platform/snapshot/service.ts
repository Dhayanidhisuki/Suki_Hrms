/**
 * Configuration Snapshot service (BRD Part D, §19).
 *
 * A snapshot is an immutable copy of the inputs a transaction was evaluated
 * under. There is deliberately no update function in this module and none
 * should be added: a change is a *new* row that supersedes the old one
 * (supersedeSnapshot), and the old row is only ever touched to record its
 * successor. Content integrity is tamper-evident through a SHA-256 over the
 * canonical JSON (canonical.ts), re-checked on every read.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '../audit/service';
import type { PlatformActor } from '../contracts';
import { canonicalJson, sha256Hash } from './canonical';

export { canonicalJson, sha256Hash };

type Db = Prisma.TransactionClient | typeof prisma;

export type TakeSnapshotInput = {
  companyId: number;
  snapshotTypeCode: string;
  sourceEntityType: string;
  sourceEntityId: number;
  content: unknown;
  actor: PlatformActor;
  triggerRequestId?: number;
  note?: string;
};

export type SnapshotView = {
  id: number;
  content: unknown;
  sha256Hash: string;
  takenAt: Date;
  supersededById: number | null;
};

export type SnapshotVerifyResult = 'INTACT' | 'DIVERGENT' | 'MISSING';

export class SnapshotError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'SnapshotError';
    this.code = code;
    this.status = status;
  }
}

function parseContent(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}

/**
 * Capture a snapshot. Callers that need the capture inside the same database
 * transaction as their state change (§19.5) pass their transaction client.
 */
export async function takeSnapshot(input: TakeSnapshotInput, db: Db = prisma): Promise<{ id: number; sha256Hash: string }> {
  const contentJson = canonicalJson(input.content);
  const hash = sha256Hash(contentJson);

  const row = await db.configSnapshot.create({
    data: {
      companyId: input.companyId,
      snapshotTypeCode: input.snapshotTypeCode,
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      triggerRequestId: input.triggerRequestId ?? null,
      contentJson,
      sha256Hash: hash,
      takenByUserId: input.actor.userId ?? null,
      note: input.note ?? null,
    },
    select: { id: true, sha256Hash: true },
  });

  await audit(
    {
      companyId: input.companyId,
      entityType: 'ConfigSnapshot',
      entityId: row.id,
      entityRef: `${input.snapshotTypeCode}/${input.sourceEntityType}/${input.sourceEntityId}`,
      action: 'SNAPSHOT_CAPTURE',
      actor: input.actor,
      after: { snapshotTypeCode: input.snapshotTypeCode, sha256Hash: hash, triggerRequestId: input.triggerRequestId ?? null },
      remark: input.note ?? null,
    },
    db,
  );

  return { id: row.id, sha256Hash: row.sha256Hash };
}

/** Read a snapshot. Company-scoped: a snapshot is never read across companies (§19.6 rule 5). */
export async function readSnapshot(companyId: number, id: number): Promise<SnapshotView | null> {
  const row = await prisma.configSnapshot.findFirst({
    where: { id, companyId },
    select: { id: true, contentJson: true, sha256Hash: true, takenAt: true, supersededById: true },
  });
  if (!row) return null;
  return {
    id: row.id,
    content: parseContent(row.contentJson),
    sha256Hash: row.sha256Hash,
    takenAt: row.takenAt,
    supersededById: row.supersededById,
  };
}

/** Recompute the hash from the stored content and compare with the stored hash. */
export async function verifySnapshot(companyId: number, id: number): Promise<SnapshotVerifyResult> {
  const row = await prisma.configSnapshot.findFirst({
    where: { id, companyId },
    select: { contentJson: true, sha256Hash: true },
  });
  if (!row) return 'MISSING';
  // The stored contentJson is already canonical; re-canonicalising the parsed
  // value guards against a row written by another tool with different spacing.
  const recomputed = sha256Hash(canonicalJson(parseContent(row.contentJson)));
  return recomputed === row.sha256Hash.toLowerCase() ? 'INTACT' : 'DIVERGENT';
}

/**
 * Supersede: write a new snapshot of the same type for the same source entity
 * and link the old row to it (§19.8). The old content is never modified.
 */
export async function supersedeSnapshot(input: {
  companyId: number;
  id: number;
  reason: string;
  actor: PlatformActor;
  newContent: unknown;
  triggerRequestId?: number;
}): Promise<{ id: number }> {
  const reason = input.reason?.trim();
  if (!reason) throw new SnapshotError('SNAP-REASON-400', 'A supersede reason is mandatory');

  return prisma.$transaction(async (tx) => {
    const old = await tx.configSnapshot.findFirst({
      where: { id: input.id, companyId: input.companyId },
    });
    if (!old) throw new SnapshotError('SNAP-404', 'Snapshot not found', 404);
    if (old.supersededById) {
      throw new SnapshotError('SNAP-SUPERSEDED-409', `Snapshot ${old.id} is already superseded by ${old.supersededById}`, 409);
    }

    const created = await takeSnapshot(
      {
        companyId: input.companyId,
        snapshotTypeCode: old.snapshotTypeCode,
        sourceEntityType: old.sourceEntityType,
        sourceEntityId: old.sourceEntityId,
        content: input.newContent,
        actor: input.actor,
        triggerRequestId: input.triggerRequestId ?? old.triggerRequestId ?? undefined,
        note: `Supersedes snapshot ${old.id}: ${reason}`.slice(0, 500),
      },
      tx,
    );

    // The only write ever made to an existing row: naming its successor.
    const { count } = await tx.configSnapshot.updateMany({
      where: { id: old.id, companyId: input.companyId, supersededById: null },
      data: { supersededById: created.id, supersededAt: new Date(), supersededReason: reason.slice(0, 500) },
    });
    if (count === 0) {
      throw new SnapshotError('SNAP-SUPERSEDED-409', `Snapshot ${old.id} was superseded concurrently`, 409);
    }

    await audit(
      {
        companyId: input.companyId,
        entityType: 'ConfigSnapshot',
        entityId: old.id,
        entityRef: `${old.snapshotTypeCode}/${old.sourceEntityType}/${old.sourceEntityId}`,
        action: 'SNAPSHOT_SUPERSEDE',
        actor: input.actor,
        before: { sha256Hash: old.sha256Hash, supersededById: null },
        after: { sha256Hash: old.sha256Hash, supersededById: created.id },
        remark: reason,
      },
      tx,
    );

    return { id: created.id };
  });
}
