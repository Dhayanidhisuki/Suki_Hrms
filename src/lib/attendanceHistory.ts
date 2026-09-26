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
  // Leave core (2026-09-25) — see prisma/schema.prisma DailyAttendance.
  leaveApplicationId?: number | null;
  leaveDayKind?: string | null;
  leaveConflictInTime?: Date | null;
  leaveConflictOutTime?: Date | null;
  leaveConflictSource?: string | null;
  leaveConflictDecision?: string | null;
  leaveConflictDecidedAt?: Date | null;
  leaveConflictDecidedByUserId?: number | null;
  // App-merge phase — endpoint attribution + GPS. GPS fields follow the
  // punch that won the endpoint; a write that replaces an endpoint must
  // pass the new coordinates (or null) explicitly.
  inLatitude?: number | null;
  inLongitude?: number | null;
  outLatitude?: number | null;
  outLongitude?: number | null;
  inSource?: string | null;
  outSource?: string | null;
  inSourceRef?: string | null;
  outSourceRef?: string | null;
}

/** Behaviour switches for the sync/merge writers (manual callers don't pass this). */
export interface UpsertOptions {
  /**
   * When true, the auto-queue logic never resets an already-decided OT or
   * LOM approval ('approved'/'rejected') back to pending — the merge
   * service checks this before writing, and this guard is the backstop.
   */
  preserveDecidedApprovals?: boolean;
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
    leaveApplicationId: number | null;
    leaveDayKind: string | null;
    leaveConflictInTime: Date | null;
    leaveConflictOutTime: Date | null;
    leaveConflictSource: string | null;
    leaveConflictDecision: string | null;
    leaveConflictDecidedAt: Date | null;
    leaveConflictDecidedByUserId: number | null;
    inLatitude: number | null;
    inLongitude: number | null;
    outLatitude: number | null;
    outLongitude: number | null;
    inSource: string | null;
    outSource: string | null;
    inSourceRef: string | null;
    outSourceRef: string | null;
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
  if (next.leaveApplicationId !== undefined && next.leaveApplicationId !== current.leaveApplicationId) return false;
  if (next.leaveDayKind !== undefined && next.leaveDayKind !== current.leaveDayKind) return false;
  if (next.leaveConflictInTime !== undefined && !sameTime(next.leaveConflictInTime, current.leaveConflictInTime)) return false;
  if (next.leaveConflictOutTime !== undefined && !sameTime(next.leaveConflictOutTime, current.leaveConflictOutTime)) return false;
  if (next.leaveConflictSource !== undefined && next.leaveConflictSource !== current.leaveConflictSource) return false;
  if (next.leaveConflictDecision !== undefined && next.leaveConflictDecision !== current.leaveConflictDecision) return false;
  if (next.leaveConflictDecidedAt !== undefined && !sameTime(next.leaveConflictDecidedAt, current.leaveConflictDecidedAt)) return false;
  if (next.leaveConflictDecidedByUserId !== undefined && next.leaveConflictDecidedByUserId !== current.leaveConflictDecidedByUserId) return false;
  if (next.inLatitude !== undefined && next.inLatitude !== current.inLatitude) return false;
  if (next.inLongitude !== undefined && next.inLongitude !== current.inLongitude) return false;
  if (next.outLatitude !== undefined && next.outLatitude !== current.outLatitude) return false;
  if (next.outLongitude !== undefined && next.outLongitude !== current.outLongitude) return false;
  if (next.inSource !== undefined && next.inSource !== current.inSource) return false;
  if (next.outSource !== undefined && next.outSource !== current.outSource) return false;
  if (next.inSourceRef !== undefined && next.inSourceRef !== current.inSourceRef) return false;
  if (next.outSourceRef !== undefined && next.outSourceRef !== current.outSourceRef) return false;
  return true;
}

export interface UpsertResult {
  /** 'created' — no prior row; 'updated' — prior values snapshotted to history; 'unchanged' — nothing written. */
  outcome: 'created' | 'updated' | 'unchanged';
}

/** Statuses only a person (approval / manual entry) ever writes — never the device. */
const HUMAN_DECIDED_STATUSES = new Set(['Leave', 'OnDuty']);

/**
 * Should an ingestion write (device sync / file import) leave this row alone?
 *
 * A row with source 'manual' was written by a person: the Daily Attendance
 * screen, a mispunch correction, or a leave / on-duty / WFH approval. The
 * device re-reporting the same day is not new information about that
 * decision, so a 'biometric' write must not undo it. Until 2026-09-25 the
 * 8-hourly sync (2-day look-back) did exactly that — see
 * docs/TIME_OFFICE_FLOW_AUDIT_2026-09-25.md A1.
 *
 * A human-uploaded MANUAL file (incoming 'manual') is itself a human act and
 * may overwrite a manual row, but never an approved Leave / OnDuty day.
 */
export function isProtectedFromDeviceOverwrite(
  existing: { source: string; status: string; leaveApplicationId?: number | null },
  incomingSource: 'biometric' | 'manual'
): boolean {
  if (HUMAN_DECIDED_STATUSES.has(existing.status)) return true;
  // A day written by a leave approval (full, half, or sandwiched LOP) is a
  // decision, whatever its status string says. Callers that want to MERGE
  // punches into a half-day leave, or record a conflict on a full-day one,
  // check leaveDayKind themselves before asking this.
  if (existing.leaveApplicationId != null) return true;
  return incomingSource === 'biometric' && existing.source === 'manual';
}

/**
 * A punch arrived on an approved leave day. Store it on the row for HR to
 * decide (/approvals/workforce/leave-conflicts) — never applied silently.
 * Returns true when a NEW conflict was recorded (caller notifies HR), false
 * when the same punch pair was already stored, decided or not, so an
 * 8-hourly re-sync never re-flags or re-notifies the same evidence. A
 * genuinely different pair replaces the stored one and clears the decision.
 */
export async function recordLeaveConflict(
  db: Db,
  row: { id: number; leaveConflictInTime: Date | null; leaveConflictOutTime: Date | null },
  incoming: { inTime: Date | null; outTime: Date | null; source: 'biometric' | 'manual' }
): Promise<boolean> {
  if (!incoming.inTime && !incoming.outTime) return false;
  if (sameTime(row.leaveConflictInTime, incoming.inTime) && sameTime(row.leaveConflictOutTime, incoming.outTime)) return false;
  await db.dailyAttendance.update({
    where: { id: row.id },
    data: {
      leaveConflictInTime: incoming.inTime,
      leaveConflictOutTime: incoming.outTime,
      leaveConflictSource: incoming.source,
      leaveConflictDecision: null,
      leaveConflictDecidedAt: null,
      leaveConflictDecidedByUserId: null,
    },
  });
  return true;
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
  actor: { userId: number | null; changedBySource: string },
  opts: UpsertOptions = {}
): Promise<UpsertResult> {
  const existing = await db.dailyAttendance.findUnique({
    where: { employeeId_date: { employeeId, date } },
  });

  // An OT/LOM decision a human already made ('approved'/'rejected') is never
  // reopened by an automatic sync write. The merge service skips such days
  // before it gets here; this is the backstop for any automatic writer that
  // reaches this helper directly. Pending queues are unaffected — a changed
  // punch re-pends them exactly as before.
  const otDecided = Boolean(opts.preserveDecidedApprovals && existing && ['approved', 'rejected'].includes(existing.otApprovalStatus ?? ''));
  const lomDecided = Boolean(opts.preserveDecidedApprovals && existing && ['approved', 'rejected'].includes(existing.lomApprovalStatus ?? ''));

  // Auto-queue OT for approval the moment a write gives a day real OT
  // minutes — the OT Approval workflow (src/app/api/workforce/attendance/ot)
  // reads otApprovalStatus='pending_manager' as its queue, so every writer
  // that ever sets otMinutesCalculated (biometric sync, manual entry,
  // mispunch approval) needs to land there without each one re-implementing
  // this. The OT approval route itself passes otApprovalStatus explicitly
  // (its own decision) — that's the only case this must NOT override, hence
  // the `=== undefined` guard. Employees without JobInfo.overtimeAllowed
  // never queue at all: their calculated OT is informational only.
  //
  // Re-queue ONLY when the calculated minutes actually change. The device
  // sync re-writes the same day every 8 hours; until 2026-09-25 each pass
  // reset an approved day back to pending_manager and nulled the approved
  // minutes (audit A2). Same minutes = same evidence = same decision.
  let resolvedValues = values;
  if (values.otApprovalStatus === undefined && values.otMinutesCalculated !== undefined && !otDecided) {
    const otMinutesChanged = !existing || existing.otMinutesCalculated !== values.otMinutesCalculated;
    if (otMinutesChanged) {
      const otEligible = values.otMinutesCalculated > 0 && (await resolveOtEligibility(db, employeeId));
      resolvedValues = { ...values, otApprovalStatus: otEligible ? 'pending_manager' : null, otMinutesApproved: null };
    }
  }

  // Auto-queue LOM for approval when late/early-out minutes are written.
  // The LOM Approval workflow reads lomApprovalStatus='pending' as its
  // queue. Only queue when the writer doesn't explicitly set
  // lomApprovalStatus (the LOM approval route sets it explicitly) AND the
  // patch actually carries late/early-out minutes that DIFFER from what is
  // stored. Writers that touch other fields only (OT approve, leave cancel)
  // must leave the key absent so HR's existing approved/rejected decision
  // in the DB persists — previously they got 0 + 0 = 0 → status reset to
  // null, and payroll's fallback then deducted rejected minutes.
  const carriesLomMinutes = 'lateMinutes' in values || 'earlyOutMinutes' in values;
  if (resolvedValues.lomApprovalStatus === undefined && carriesLomMinutes && !lomDecided) {
    const nextLate = resolvedValues.lateMinutes ?? existing?.lateMinutes ?? 0;
    const nextEarly = resolvedValues.earlyOutMinutes ?? existing?.earlyOutMinutes ?? 0;
    const lomChanged = !existing || existing.lateMinutes !== nextLate || existing.earlyOutMinutes !== nextEarly;
    if (lomChanged) {
      resolvedValues = { ...resolvedValues, lomApprovalStatus: nextLate + nextEarly > 0 ? 'pending' : null };
    }
  }

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
        leaveApplicationId: resolvedValues.leaveApplicationId ?? null,
        leaveDayKind: resolvedValues.leaveDayKind ?? null,
        leaveConflictInTime: resolvedValues.leaveConflictInTime ?? null,
        leaveConflictOutTime: resolvedValues.leaveConflictOutTime ?? null,
        leaveConflictSource: resolvedValues.leaveConflictSource ?? null,
        leaveConflictDecision: resolvedValues.leaveConflictDecision ?? null,
        leaveConflictDecidedAt: resolvedValues.leaveConflictDecidedAt ?? null,
        leaveConflictDecidedByUserId: resolvedValues.leaveConflictDecidedByUserId ?? null,
        inLatitude: resolvedValues.inLatitude ?? null,
        inLongitude: resolvedValues.inLongitude ?? null,
        outLatitude: resolvedValues.outLatitude ?? null,
        outLongitude: resolvedValues.outLongitude ?? null,
        inSource: resolvedValues.inSource ?? null,
        outSource: resolvedValues.outSource ?? null,
        inSourceRef: resolvedValues.inSourceRef ?? null,
        outSourceRef: resolvedValues.outSourceRef ?? null,
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
      leaveApplicationId: existing.leaveApplicationId,
      inLatitude: existing.inLatitude,
      inLongitude: existing.inLongitude,
      outLatitude: existing.outLatitude,
      outLongitude: existing.outLongitude,
      inSource: existing.inSource,
      outSource: existing.outSource,
      inSourceRef: existing.inSourceRef,
      outSourceRef: existing.outSourceRef,
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
