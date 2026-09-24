/**
 * Shared attendance reconciliation — the single boundary every automatic
 * attendance writer (device-API biometric sync, legacy bulk import, mobile
 * app database sync) funnels through when APP merge is enabled.
 *
 * Why this exists: if the biometric feed and the app feed each wrote
 * DailyAttendance directly, whichever sync ran last would silently erase
 * the other's punches. Instead each writer records only ITS OWN day's
 * contribution in AttendanceSourceDay (one row per employee/date/source —
 * a per-source rollup, not a raw punch log), then calls
 * reconcileAttendanceDay, which re-derives the final row from BOTH
 * sources' current contributions:
 *
 *   final inTime  = earliest valid in  (tie -> app, keeps its GPS)
 *   final outTime = latest  valid out  (tie -> app)
 *
 * Because the merge recomputes from each source's stored contribution —
 * not from the previously saved final row — a source-side correction
 * (e.g. the app changing an in-punch from 08:00 to 09:00) propagates
 * correctly: the stale 08:00 disappears instead of winning min() forever.
 *
 * Protections (checked before any write):
 *   - Months in FINALIZED / FROZEN / READY_FOR_PAYROLL are never touched.
 *   - A day whose last write came from a human (latest
 *     DailyAttendanceHistory.changedBySource = 'manual' — manual
 *     corrections, approved mispunch, leave/WFH/on-duty application
 *     writes) is never overwritten; if the merged result differs it is
 *     reported as needs_review. Approval-owned statuses (Leave, OnDuty,
 *     Permission, WFH) are likewise always held. Machine-written rows —
 *     'system_finalize' auto absent/LOP/holiday marking and previous
 *     sync writes — carry no human decision, so real punches supersede
 *     them, matching what the biometric import already does today.
 *   - Days with a decided OT or LOM approval (approved/rejected) are
 *     likewise held for review when merged punches differ; the
 *     preserveDecidedApprovals helper option is the backstop.
 *   - Approval-owned statuses (Leave, OnDuty, Permission, WFH) are never
 *     replaced; auto-marked Absent/LOP/Holiday/WeeklyOff rows (source
 *     'SYSTEM_AUTO', no human write) ARE superseded by real punches —
 *     the same thing the biometric import already does.
 *
 * The whole feature is behind ESSL_SYNC_ENABLED — when it is not 'true'
 * (appMergeEnabled() === false) the biometric writers keep their original
 * direct-write path and none of this code runs, so existing behaviour is
 * byte-identical.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { upsertDailyAttendanceWithHistory } from './attendanceHistory';
import {
  deriveStatusAndMinutes,
  resolveDailyShiftWithOverride,
  resolveEmployeeShiftConfig,
  type EmployeeShiftConfig,
} from './biometricConversion';
import { isWeeklyOffForEmployee, isHolidayOrYearlyLeave } from './weeklyOff';

type Db = PrismaClient | Prisma.TransactionClient;

export type AttendanceSourceName = 'biometric' | 'app';

/** True only when the app-database merge is enabled. Everything automatic stays on the old path otherwise. */
export function appMergeEnabled(): boolean {
  return process.env.ESSL_SYNC_ENABLED === 'true';
}

/** One source's contribution to an employee's working day. */
export interface SourceContribution {
  inTime: Date | null;
  outTime: Date | null;
  /** Legacy import's hours-only fallback — biometric source only; used only when neither source has a punch pair. */
  hours?: number | null;
  inLatitude?: number | null;
  inLongitude?: number | null;
  outLatitude?: number | null;
  outLongitude?: number | null;
  /** The source row this contribution came from (app ROW_ID / device day key) for traceability. */
  sourceRowId?: string | null;
}

export type MergeOutcome =
  | 'created'
  | 'updated'
  | 'unchanged'
  | 'no_source'          // neither feed contributed anything for this day
  | 'skipped_locked_month' // FINALIZED / FROZEN / READY_FOR_PAYROLL
  | 'needs_review';       // protected day whose merged result would differ — held for a human

/**
 * Replaces one source's stored contribution for an employee/day. Each
 * writer owns only its own source rows, so the two feeds can never
 * overwrite each other's input to the merge.
 */
export async function recordSourceContribution(
  db: Db,
  employeeId: number,
  date: Date,
  source: AttendanceSourceName,
  c: SourceContribution
): Promise<void> {
  await db.attendanceSourceDay.upsert({
    where: { employeeId_date_source: { employeeId, date, source } },
    create: {
      employeeId,
      date,
      source,
      inTime: c.inTime,
      outTime: c.outTime,
      hours: c.hours ?? null,
      inLatitude: c.inLatitude ?? null,
      inLongitude: c.inLongitude ?? null,
      outLatitude: c.outLatitude ?? null,
      outLongitude: c.outLongitude ?? null,
      sourceRowId: c.sourceRowId ?? null,
      lastSeenAt: new Date(),
    },
    update: {
      inTime: c.inTime,
      outTime: c.outTime,
      hours: c.hours ?? null,
      inLatitude: c.inLatitude ?? null,
      inLongitude: c.inLongitude ?? null,
      outLatitude: c.outLatitude ?? null,
      outLongitude: c.outLongitude ?? null,
      sourceRowId: c.sourceRowId ?? null,
      lastSeenAt: new Date(),
    },
  });
}

/** Statuses only an approval flow can produce — an automatic merge never replaces them. */
const DECISION_STATUSES = new Set(['Leave', 'OnDuty', 'Permission', 'WFH']);

/** The only source attribution that marks a human decision — sync must never overwrite it. */
const HUMAN_CHANGED_BY = 'manual';

const LOCKED_MONTH_STATUSES = new Set(['FINALIZED', 'FROZEN', 'READY_FOR_PAYROLL']);

interface EndpointPick {
  time: Date | null;
  source: AttendanceSourceName | null;
  ref: string | null;
  lat: number | null;
  lon: number | null;
}

/** A candidate that actually carries a punch (non-null time). */
interface EndpointCandidate extends Omit<EndpointPick, 'time' | 'source'> {
  time: Date;
  source: AttendanceSourceName;
}

/**
 * Pick the winning endpoint across sources.
 *  - kind 'in': earliest valid punch wins.
 *  - kind 'out': latest valid punch wins.
 *  - Exact tie -> app wins, so the app's GPS is preserved deterministically
 *    and the result never depends on which sync ran first.
 */
function pickEndpoint(
  kind: 'in' | 'out',
  bio: { time: Date | null; ref: string | null },
  app: { time: Date | null; ref: string | null; lat: number | null; lon: number | null }
): EndpointPick {
  const candidates: EndpointCandidate[] = [];
  // App is pushed first so the reduce's tie-keep favours it deterministically.
  if (app.time) candidates.push({ time: app.time, source: 'app', ref: app.ref, lat: app.lat, lon: app.lon });
  if (bio.time) candidates.push({ time: bio.time, source: 'biometric', ref: bio.ref, lat: null, lon: null });
  if (candidates.length === 0) return { time: null, source: null, ref: null, lat: null, lon: null };

  return candidates.reduce((a, b) => {
    const cmp = a.time.getTime() - b.time.getTime();
    if (kind === 'in' ? cmp <= 0 : cmp >= 0) return a; // tie keeps 'a' — app first wins ties
    return b;
  });
}

/**
 * Recomputes the final DailyAttendance row for one employee/date from the
 * stored per-source contributions, writes it through the history helper,
 * and returns what happened. Never throws on protected/locked days — it
 * reports them so sync runs can count and surface them.
 */
export async function reconcileAttendanceDay(
  db: Db,
  employeeId: number,
  date: Date,
  opts: { companyId: number; userId: number | null; shiftConfig?: EmployeeShiftConfig }
): Promise<MergeOutcome> {
  const [sourceDays, existing, summary, lastHistory] = await Promise.all([
    db.attendanceSourceDay.findMany({ where: { employeeId, date } }),
    db.dailyAttendance.findUnique({ where: { employeeId_date: { employeeId, date } } }),
    db.monthlyAttendanceSummary.findUnique({
      where: { employeeId_year_month: { employeeId, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 } },
      select: { status: true },
    }),
    db.dailyAttendanceHistory.findFirst({
      where: { employeeId, date },
      orderBy: { changedAt: 'desc' },
      select: { changedBySource: true },
    }),
  ]);

  if (summary && LOCKED_MONTH_STATUSES.has(summary.status)) return 'skipped_locked_month';

  const bio = sourceDays.find((s) => s.source === 'biometric') ?? null;
  const app = sourceDays.find((s) => s.source === 'app') ?? null;
  if (!bio && !app) return 'no_source';

  const inPick = pickEndpoint(
    'in',
    { time: bio?.inTime ?? null, ref: bio?.sourceRowId ?? null },
    { time: app?.inTime ?? null, ref: app?.sourceRowId ?? null, lat: app?.inLatitude ?? null, lon: app?.inLongitude ?? null }
  );
  const outPick = pickEndpoint(
    'out',
    { time: bio?.outTime ?? null, ref: bio?.sourceRowId ?? null },
    { time: app?.outTime ?? null, ref: app?.sourceRowId ?? null, lat: app?.outLatitude ?? null, lon: app?.outLongitude ?? null }
  );

  // Day-level source: which feed(s) supplied the stored punches.
  const daySource =
    inPick.source && outPick.source
      ? inPick.source === outPick.source
        ? inPick.source
        : 'biometric+app'
      : inPick.source ?? outPick.source ?? (bio ? 'biometric' : 'app');

  // Resolve the shift (override-aware, same as the import path) and derive
  // status/minutes from the merged pair using the existing engine — no new
  // attendance math lives here.
  const config = opts.shiftConfig ?? (await resolveEmployeeShiftConfig(employeeId));
  const shift = await resolveDailyShiftWithOverride(employeeId, date, config);
  const derived = deriveStatusAndMinutes(
    bio?.hours ?? null,
    inPick.time,
    outPick.time,
    shift,
    config.otThresholdMinutes,
    config.maxOtMinutesPerDay
  );

  // A lone punch on either endpoint is MissingPunch, matching the existing
  // sync convention; the hours-only fallback inside deriveStatusAndMinutes
  // only applies when neither source contributed a punch at all (legacy
  // import days).
  const hasSinglePunch = Boolean(inPick.time) !== Boolean(outPick.time);
  const status = hasSinglePunch ? 'MissingPunch' : derived.status;
  const effectiveInTime = derived.snappedInTime ?? inPick.time;

  // Holiday / weekly-off worked flags — same rule as the import path:
  // any punch on a non-Absent day checks the calendar masters.
  let isWeeklyOffWorked = false;
  let isHolidayWorked = false;
  if ((inPick.time || outPick.time) && status !== 'Absent') {
    isWeeklyOffWorked = await isWeeklyOffForEmployee(opts.companyId, employeeId, date);
    isHolidayWorked = await isHolidayOrYearlyLeave(opts.companyId, date);
  }

  // ── Protection gates ──────────────────────────────────────────────
  // A human or workflow decision on this day is authoritative. Compare the
  // merged result against what is stored: identical -> 'unchanged' anyway;
  // different -> 'needs_review' and leave the row exactly as it is.
  const lastChangedBy = lastHistory?.changedBySource ?? null;
  // Protected when we can positively see a human decision: a 'manual'
  // history write, or the row itself carrying source='manual' (rows that
  // predate history tracking). Approval-owned statuses are always held.
  // Machine-written rows — 'SYSTEM_AUTO' absent/LOP/holiday marks and
  // previous biometric/app/import sync writes — carry no human decision,
  // so real punches supersede them (the biometric import already behaves
  // this way today).
  const workflowOwned = existing
    ? lastChangedBy === HUMAN_CHANGED_BY ||
      existing.source === HUMAN_CHANGED_BY ||
      DECISION_STATUSES.has(existing.status)
    : false;
  const decidedApprovals = existing
    ? ['approved', 'rejected'].includes(existing.otApprovalStatus ?? '') ||
      ['approved', 'rejected'].includes(existing.lomApprovalStatus ?? '')
    : false;

  if (existing && (workflowOwned || decidedApprovals)) {
    const punchesDiffer =
      effectiveInTime?.getTime() !== (existing.inTime?.getTime() ?? null) ||
      outPick.time?.getTime() !== (existing.outTime?.getTime() ?? null);
    if (!punchesDiffer && !workflowOwned) {
      // Same punches on a decided-approval day — safe to let the write
      // proceed (GPS/attendance-metadata updates are still recorded),
      // preserveDecidedApprovals keeps the decision untouched.
    } else if (!punchesDiffer && workflowOwned) {
      return 'unchanged';
    } else {
      return 'needs_review';
    }
  }

  const result = await upsertDailyAttendanceWithHistory(
    db,
    employeeId,
    date,
    {
      status,
      inTime: effectiveInTime,
      outTime: outPick.time,
      workingMinutes: derived.workingMinutes,
      lateMinutes: derived.lateMinutes,
      earlyOutMinutes: derived.earlyOutMinutes,
      otMinutesCalculated: derived.otMinutes,
      source: daySource,
      shiftMasterId: shift.shiftMasterId,
      isWeeklyOffWorked: isWeeklyOffWorked || undefined,
      isHolidayWorked: isHolidayWorked || undefined,
      inLatitude: inPick.lat,
      inLongitude: inPick.lon,
      outLatitude: outPick.lat,
      outLongitude: outPick.lon,
      inSource: inPick.source,
      outSource: outPick.source,
      inSourceRef: inPick.ref,
      outSourceRef: outPick.ref,
    },
    { userId: opts.userId, changedBySource: daySource },
    { preserveDecidedApprovals: true }
  );

  return result.outcome;
}
