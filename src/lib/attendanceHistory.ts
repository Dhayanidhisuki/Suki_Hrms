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
  otSettlementType?: string | null;
  otManagerActionByUserId?: number | null;
  otManagerActionAt?: Date | null;
  otHrActionByUserId?: number | null;
  otHrActionAt?: Date | null;
  lomApprovalStatus?: string | null;
  isWeeklyOffWorked?: boolean;
  isHolidayWorked?: boolean;
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
    lomApprovalStatus: string | null;
    isWeeklyOffWorked: boolean;
    isHolidayWorked: boolean;
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
  if (next.lomApprovalStatus !== undefined && next.lomApprovalStatus !== current.lomApprovalStatus) return false;
  if (next.isWeeklyOffWorked !== undefined && next.isWeeklyOffWorked !== current.isWeeklyOffWorked) return false;
  if (next.isHolidayWorked !== undefined && next.isHolidayWorked !== current.isHolidayWorked) return false;
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
/** Current JobInfo.overtimeAllowed for one employee — the per-employee OT eligibility flag (BRD: "OT applicable... as per employee basis"). */
async function resolveOtEligibility(db: Db, employeeId: number): Promise<boolean> {
  const jobInfo = await db.jobInfo.findFirst({ where: { employeeId, effectiveTo: null }, select: { overtimeAllowed: true } });
  return jobInfo?.overtimeAllowed ?? false;
}

export async function upsertDailyAttendanceWithHistory(
  db: Db,
  employeeId: number,
  date: Date,
  values: DailyAttendanceValues,
  actor: { userId: number | null; changedBySource: string }
): Promise<UpsertResult> {
  // Auto-queue OT for approval the moment a write gives a day real OT
  // minutes — the OT Approval workflow (src/app/api/workforce/attendance/ot)
  // reads otApprovalStatus='pending_manager' as its queue, so every writer
  // that ever sets otMinutesCalculated (biometric sync, manual entry,
  // mispunch approval) needs to land there without each one re-implementing
  // this. The OT approval route itself passes otApprovalStatus explicitly
  // (its own decision) — that's the only case this must NOT override, hence
  // the `=== undefined` guard. Employees without JobInfo.overtimeAllowed
  // never queue at all: their calculated OT is informational only.
  let resolvedValues = values;
  if (values.otApprovalStatus === undefined && values.otMinutesCalculated !== undefined) {
    const otEligible = values.otMinutesCalculated > 0 && (await resolveOtEligibility(db, employeeId));
    resolvedValues = { ...values, otApprovalStatus: otEligible ? 'pending_manager' : null, otMinutesApproved: null };
  }

  // Auto-queue LOM for approval when late/early-out minutes are written.
  // The LOM Approval workflow reads lomApprovalStatus='pending' as its
  // queue. Only queue when the writer doesn't explicitly set
  // lomApprovalStatus (the LOM approval route sets it explicitly).
  // Only queue when there are actual LOM minutes (late + early-out > 0
  // after the shift's grace period, which is applied at approval time).
  if (resolvedValues.lomApprovalStatus === undefined) {
    const lomMinutes = (resolvedValues.lateMinutes ?? 0) + (resolvedValues.earlyOutMinutes ?? 0);
    resolvedValues = { ...resolvedValues, lomApprovalStatus: lomMinutes > 0 ? 'pending' : null };
  }

  const existing = await db.dailyAttendance.findUnique({
    where: { employeeId_date: { employeeId, date } },
  });

  if (!existing) {
    await db.dailyAttendance.create({
      data: {
        employeeId,
        date,
        status: resolvedValues.status ?? 'Absent',
        inTime: resolvedValues.inTime ?? null,
        outTime: resolvedValues.outTime ?? null,
        workingMinutes: resolvedValues.workingMinutes ?? 0,
        lateMinutes: resolvedValues.lateMinutes ?? 0,
        earlyOutMinutes: resolvedValues.earlyOutMinutes ?? 0,
        otMinutesCalculated: resolvedValues.otMinutesCalculated ?? 0,
        otMinutesApproved: resolvedValues.otMinutesApproved ?? null,
        otApprovalStatus: resolvedValues.otApprovalStatus ?? null,
        lomApprovalStatus: resolvedValues.lomApprovalStatus ?? null,
        isWeeklyOffWorked: resolvedValues.isWeeklyOffWorked ?? false,
        isHolidayWorked: resolvedValues.isHolidayWorked ?? false,
        source: resolvedValues.source ?? 'manual',
        remarks: resolvedValues.remarks ?? null,
        shiftMasterId: resolvedValues.shiftMasterId ?? null,
        createdByUserId: actor.userId,
      },
    });
    return { outcome: 'created' };
  }

  if (isUnchanged(existing, resolvedValues)) return { outcome: 'unchanged' };

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
      isWeeklyOffWorked: existing.isWeeklyOffWorked,
      isHolidayWorked: existing.isHolidayWorked,
      source: existing.source,
      remarks: existing.remarks,
      changedByUserId: actor.userId,
      changedBySource: actor.changedBySource,
    },
  });

  await db.dailyAttendance.update({
    where: { employeeId_date: { employeeId, date } },
    data: { ...resolvedValues, updatedByUserId: actor.userId },
  });

  return { outcome: 'updated' };
}
