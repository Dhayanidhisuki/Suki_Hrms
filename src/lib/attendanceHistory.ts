/**
 * Change history for DailyAttendance.
 *
 * Both write paths — the manual Daily Attendance route and the biometric
 * import conversion — go through upsertDailyAttendanceWithHistory instead of
 * calling prisma.dailyAttendance.upsert directly, so an overwrite can never
 * silently destroy what was there: the superseded values are snapshotted
 * into DailyAttendanceHistory first.
 *
 * Nothing is recorded when a write doesn't actually change anything — a
 * biometric re-import of unchanged data (which happens routinely, since
 * imports are idempotent and get re-run) leaves no history noise behind.
 */

import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/** The mutable fields a write may change. */
export interface DailyAttendanceValues {
  status?: string;
  inTime?: Date | null;
  outTime?: Date | null;
  workingMinutes?: number;
  lateMinutes?: number;
  earlyOutMinutes?: number;
  otMinutesCalculated?: number;
  otMinutesApproved?: number | null;
  otApprovalStatus?: string | null;
  source?: string;
  remarks?: string | null;
  shiftMasterId?: number | null;
}

function sameTime(a: Date | null | undefined, b: Date | null | undefined) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

/**
 * True when `next` would leave every field of `current` as it already is —
 * fields the caller didn't supply are ignored, not treated as "clear it".
 */
function isUnchanged(
  current: {
    status: string;
    inTime: Date | null;
    outTime: Date | null;
    workingMinutes: number;
    lateMinutes: number;
    earlyOutMinutes: number;
    otMinutesCalculated: number;
    otMinutesApproved: number | null;
    otApprovalStatus: string | null;
    source: string;
    remarks: string | null;
    shiftMasterId: number | null;
  },
  next: DailyAttendanceValues
) {
  if (next.status !== undefined && next.status !== current.status) return false;
  if (next.inTime !== undefined && !sameTime(next.inTime, current.inTime)) return false;
  if (next.outTime !== undefined && !sameTime(next.outTime, current.outTime)) return false;
  if (next.workingMinutes !== undefined && next.workingMinutes !== current.workingMinutes) return false;
  if (next.lateMinutes !== undefined && next.lateMinutes !== current.lateMinutes) return false;
  if (next.earlyOutMinutes !== undefined && next.earlyOutMinutes !== current.earlyOutMinutes) return false;
  if (next.otMinutesCalculated !== undefined && next.otMinutesCalculated !== current.otMinutesCalculated) return false;
  if (next.otMinutesApproved !== undefined && next.otMinutesApproved !== current.otMinutesApproved) return false;
  if (next.otApprovalStatus !== undefined && next.otApprovalStatus !== current.otApprovalStatus) return false;
  if (next.source !== undefined && next.source !== current.source) return false;
  if (next.remarks !== undefined && next.remarks !== current.remarks) return false;
  if (next.shiftMasterId !== undefined && next.shiftMasterId !== current.shiftMasterId) return false;
  return true;
}

export interface UpsertResult {
  /** 'created' — no prior row; 'updated' — prior values snapshotted to history; 'unchanged' — nothing written. */
  outcome: 'created' | 'updated' | 'unchanged';
}

/**
 * Upserts one DailyAttendance row, snapshotting the previous values into
 * DailyAttendanceHistory whenever an existing row is actually changed.
 *
 * `changedBySource` records what caused the change ('manual' | 'biometric'),
 * which is not necessarily the same as the row's own `source` field.
 */
export async function upsertDailyAttendanceWithHistory(
  db: Db,
  employeeId: number,
  date: Date,
  values: DailyAttendanceValues,
  actor: { userId: number | null; changedBySource: string }
): Promise<UpsertResult> {
  const existing = await db.dailyAttendance.findUnique({
    where: { employeeId_date: { employeeId, date } },
  });

  if (!existing) {
    await db.dailyAttendance.create({
      data: {
        employeeId,
        date,
        status: values.status ?? 'Absent',
        inTime: values.inTime ?? null,
        outTime: values.outTime ?? null,
        workingMinutes: values.workingMinutes ?? 0,
        lateMinutes: values.lateMinutes ?? 0,
        earlyOutMinutes: values.earlyOutMinutes ?? 0,
        otMinutesCalculated: values.otMinutesCalculated ?? 0,
        otMinutesApproved: values.otMinutesApproved ?? null,
        otApprovalStatus: values.otApprovalStatus ?? null,
        source: values.source ?? 'manual',
        remarks: values.remarks ?? null,
        shiftMasterId: values.shiftMasterId ?? null,
        createdByUserId: actor.userId,
      },
    });
    return { outcome: 'created' };
  }

  if (isUnchanged(existing, values)) return { outcome: 'unchanged' };

  // Snapshot first, then overwrite — so the prior values survive even if the
  // update below is what someone later needs to undo.
  await db.dailyAttendanceHistory.create({
    data: {
      employeeId,
      date,
      status: existing.status,
      inTime: existing.inTime,
      outTime: existing.outTime,
      workingMinutes: existing.workingMinutes,
      lateMinutes: existing.lateMinutes,
      earlyOutMinutes: existing.earlyOutMinutes,
      otMinutesCalculated: existing.otMinutesCalculated,
      otMinutesApproved: existing.otMinutesApproved,
      otApprovalStatus: existing.otApprovalStatus,
      source: existing.source,
      remarks: existing.remarks,
      changedByUserId: actor.userId,
      changedBySource: actor.changedBySource,
    },
  });

  await db.dailyAttendance.update({
    where: { employeeId_date: { employeeId, date } },
    data: { ...values, updatedByUserId: actor.userId },
  });

  return { outcome: 'updated' };
}
