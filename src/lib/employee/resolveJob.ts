/**
 * Effective-dated job history and point-in-time resolution (BRD 01 §15,
 * §17, §18, §19).
 *
 * `JobInfo` is already the dated job row (effectiveFrom / effectiveTo,
 * NULL effectiveTo = current). This module is the ONE resolution service
 * every consumer is meant to call (§15.4): `resolveJob`, `resolvePeriod`,
 * `resolveManagers`, `requiredNoticeDaysOn`. Job attribute changes go
 * through `changeJob`, which closes the open row at D − 1 and inserts the
 * new full-attribute row in the same transaction (§15.3 / §18.2 COMMIT).
 *
 * Reporting managers stay denormalised on `Employee.reportingManagerId` /
 * `secondReportingManagerId` (every existing query reads them); every change
 * also writes an `EmployeeReportingHistory` row so a past approval trail
 * resolves to the manager of that date (§17.1).
 *
 * Date-only semantics: rows are compared on the UTC calendar day.
 */

import { Prisma, type JobInfo } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/platform/audit/service';
import { emitPlatformEvent } from '@/lib/platform/events';
import type { PlatformActor } from '@/lib/platform/contracts';
import { wouldCreateCycle } from '@/lib/reportingManager';
import type { JobChangeReason } from '@/lib/validations/employee-master';

type Db = Prisma.TransactionClient | typeof prisma;

// ─── Pure date + row helpers (unit-tested) ───────────────────────────────────

export type ResolveMode = 'AS_ON_END' | 'AS_ON_START' | 'PREDOMINANT' | 'DAY_WEIGHTED';

export type DatedRow = { effectiveFrom: Date; effectiveTo: Date | null };

const DAY_MS = 86_400_000;

/** Strip the time component: the same calendar day at UTC midnight. */
export function utcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDays(d: Date, days: number): Date {
  return new Date(utcDay(d).getTime() + days * DAY_MS);
}

/** Inclusive day count between two dates (same day → 1; to < from → 0). */
export function daysBetweenInclusive(from: Date, to: Date): number {
  const diff = Math.round((utcDay(to).getTime() - utcDay(from).getTime()) / DAY_MS);
  return diff < 0 ? 0 : diff + 1;
}

function covers(row: DatedRow, day: Date): boolean {
  const t = utcDay(day).getTime();
  const from = utcDay(row.effectiveFrom).getTime();
  const to = row.effectiveTo ? utcDay(row.effectiveTo).getTime() : Number.POSITIVE_INFINITY;
  return from <= t && to >= t;
}

/**
 * The row in force on `asOn` (§15.4). When several rows cover the day
 * (should not happen after changeJob, but legacy data may overlap) the one
 * with the latest effectiveFrom wins. A row whose effectiveTo precedes its
 * effectiveFrom is a superseded/cancelled row and never resolves.
 */
export function pickRowAsOn<T extends DatedRow>(rows: T[], asOn: Date): T | null {
  let best: T | null = null;
  for (const row of rows) {
    if (!covers(row, asOn)) continue;
    if (!best || utcDay(row.effectiveFrom).getTime() > utcDay(best.effectiveFrom).getTime()) best = row;
  }
  return best;
}

/** Every row overlapping [from, to] with the number of days it held (DAY_WEIGHTED, §15.5). */
export function splitPeriodByRows<T extends DatedRow>(rows: T[], from: Date, to: Date): Array<{ row: T; days: number }> {
  const start = utcDay(from);
  const end = utcDay(to);
  const out: Array<{ row: T; days: number }> = [];
  for (const row of rows) {
    const rowFrom = utcDay(row.effectiveFrom);
    const rowTo = row.effectiveTo ? utcDay(row.effectiveTo) : end;
    const overlapFrom = rowFrom > start ? rowFrom : start;
    const overlapTo = rowTo < end ? rowTo : end;
    const days = daysBetweenInclusive(overlapFrom, overlapTo);
    if (days > 0) out.push({ row, days });
  }
  out.sort((a, b) => utcDay(a.row.effectiveFrom).getTime() - utcDay(b.row.effectiveFrom).getTime());
  return out;
}

/**
 * Resolve a period in one of the four §15.4 modes. AS_ON_* return a single
 * entry carrying the whole period's day count; PREDOMINANT the row held for
 * the most days (earliest wins a tie); DAY_WEIGHTED every distinct row.
 */
export function resolveRowsForPeriod<T extends DatedRow>(
  rows: T[],
  from: Date,
  to: Date,
  mode: ResolveMode = 'AS_ON_END'
): Array<{ row: T; days: number }> {
  const total = daysBetweenInclusive(from, to);
  if (mode === 'AS_ON_END' || mode === 'AS_ON_START') {
    const row = pickRowAsOn(rows, mode === 'AS_ON_END' ? to : from);
    return row ? [{ row, days: total }] : [];
  }
  const split = splitPeriodByRows(rows, from, to);
  if (mode === 'DAY_WEIGHTED') return split;
  let best: { row: T; days: number } | null = null;
  for (const entry of split) if (!best || entry.days > best.days) best = entry;
  return best ? [best] : [];
}

// ─── Point-in-time resolution (DB) ───────────────────────────────────────────

export async function resolveJob(employeeId: number, asOn: Date, db: Db = prisma): Promise<JobInfo | null> {
  const rows = await db.jobInfo.findMany({ where: { employeeId } });
  return pickRowAsOn(rows, asOn);
}

export async function resolvePeriod(
  employeeId: number,
  from: Date,
  to: Date,
  mode: ResolveMode = 'AS_ON_END',
  db: Db = prisma
): Promise<Array<{ jobInfo: JobInfo; days: number }>> {
  const rows = await db.jobInfo.findMany({ where: { employeeId } });
  return resolveRowsForPeriod(rows, from, to, mode).map((e) => ({ jobInfo: e.row, days: e.days }));
}

export type ResolvedManagers = {
  primaryManagerId: number | null;
  secondaryManagerId: number | null;
  /** HISTORY when an EmployeeReportingHistory row covered the date, else the live pointers. */
  source: 'HISTORY' | 'CURRENT';
};

export async function resolveManagers(employeeId: number, asOn: Date, db: Db = prisma): Promise<ResolvedManagers | null> {
  const history = await db.employeeReportingHistory.findMany({ where: { employeeId } });
  const row = pickRowAsOn(history, asOn);
  if (row) return { primaryManagerId: row.primaryManagerId, secondaryManagerId: row.secondaryManagerId, source: 'HISTORY' };
  const emp = await db.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { reportingManagerId: true, secondReportingManagerId: true },
  });
  if (!emp) return null;
  return { primaryManagerId: emp.reportingManagerId, secondaryManagerId: emp.secondReportingManagerId, source: 'CURRENT' };
}

// ─── §19 Notice period ───────────────────────────────────────────────────────

export type NoticePeriodSource = 'OFFER' | 'GRADE_DEFAULT' | 'POLICY' | 'MANUAL';

/**
 * Offer value → OFFER; else Grade.defaultNoticeDays → GRADE_DEFAULT; else the
 * company FullAndFinalConfig.noticePeriodDays → POLICY; else null.
 */
export async function resolveNoticePeriod(
  companyId: number,
  gradeId: number | null | undefined,
  offerDays?: number | null,
  db: Db = prisma
): Promise<{ days: number | null; source: NoticePeriodSource | null }> {
  if (offerDays !== undefined && offerDays !== null) return { days: offerDays, source: 'OFFER' };
  if (gradeId) {
    const grade = await db.grade.findUnique({ where: { id: gradeId }, select: { defaultNoticeDays: true } });
    if (grade?.defaultNoticeDays !== null && grade?.defaultNoticeDays !== undefined) {
      return { days: grade.defaultNoticeDays, source: 'GRADE_DEFAULT' };
    }
  }
  const config = await db.fullAndFinalConfig.findUnique({ where: { companyId }, select: { noticePeriodDays: true } });
  if (config) return { days: config.noticePeriodDays, source: 'POLICY' };
  return { days: null, source: null };
}

/** F&F reads the notice period in force on the last working day (§19.2 rule 6). */
export async function requiredNoticeDaysOn(employeeId: number, date: Date, db: Db = prisma): Promise<number | null> {
  const row = await resolveJob(employeeId, date, db);
  if (row?.noticePeriodDays !== null && row?.noticePeriodDays !== undefined) return row.noticePeriodDays;
  const emp = await db.employee.findFirst({ where: { id: employeeId, deletedAt: null }, select: { companyId: true } });
  if (!emp) return null;
  return (await resolveNoticePeriod(emp.companyId, row?.gradeId ?? null, null, db)).days;
}

// ─── Reporting history ───────────────────────────────────────────────────────

export async function recordReportingChange(
  input: {
    companyId: number;
    employeeId: number;
    primaryManagerId: number | null;
    secondaryManagerId: number | null;
    effectiveFrom: Date;
    changeReason: string;
    actor: PlatformActor;
  },
  db: Db = prisma
): Promise<void> {
  const from = utcDay(input.effectiveFrom);
  const open = await db.employeeReportingHistory.findFirst({
    where: { employeeId: input.employeeId, effectiveTo: null },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (open) {
    if (open.primaryManagerId === input.primaryManagerId && open.secondaryManagerId === input.secondaryManagerId) return;
    await db.employeeReportingHistory.update({ where: { id: open.id }, data: { effectiveTo: addDays(from, -1) } });
  }
  await db.employeeReportingHistory.create({
    data: {
      companyId: input.companyId,
      employeeId: input.employeeId,
      primaryManagerId: input.primaryManagerId,
      secondaryManagerId: input.secondaryManagerId,
      effectiveFrom: from,
      effectiveTo: null,
      changeReason: input.changeReason.slice(0, 30),
      createdByUserId: input.actor.userId ?? null,
    },
  });
}

// ─── changeJob ───────────────────────────────────────────────────────────────

export class JobChangeError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'JobChangeError';
    this.status = status;
  }
}

/** Columns a change may set; every other column is carried forward from the open row. */
export type JobChangeFields = Partial<
  Pick<
    JobInfo,
    | 'departmentId'
    | 'subDepartmentId'
    | 'designationId'
    | 'gradeId'
    | 'levelId'
    | 'employeeTypeId'
    | 'categoryId'
    | 'unitId'
    | 'locationId'
    | 'costCentreId'
    | 'shiftMasterId'
    | 'shiftAssignmentType'
    | 'shiftRotationPlanId'
  >
> & { noticePeriodDays?: number | null; noticePeriodSource?: NoticePeriodSource };

export type ChangeJobInput = {
  companyId: number;
  employeeId: number;
  effectiveFrom: Date;
  changeReason: JobChangeReason;
  changeReference?: string | null;
  changes: JobChangeFields;
  reporting?: { primaryManagerId?: number | null; secondaryManagerId?: number | null };
  actor: PlatformActor;
  /** HR Admin may back-date within the §15.1 allowance; others forward-date only. */
  isAdmin: boolean;
  remarks?: string | null;
  today?: Date;
};

/** §15.1 back-dating allowance in days — 30 for location / reporting changes, 90 for the rest. */
export function backdateAllowanceDays(changes: JobChangeFields, reporting?: ChangeJobInput['reporting']): number {
  const touchesLocation = changes.locationId !== undefined;
  const touchesReporting = reporting !== undefined && (reporting.primaryManagerId !== undefined || reporting.secondaryManagerId !== undefined);
  return touchesLocation || touchesReporting ? 30 : 90;
}

const BLOCKED_STATES = new Set(['DRAFT', 'CANDIDATE_CONVERTED', 'SUSPENDED', 'SEPARATED']);
const STATE_EXEMPT_REASONS = new Set<JobChangeReason>(['JOINING', 'REHIRE', 'CORRECTION']);

function summarise(row: JobInfo) {
  return {
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    departmentId: row.departmentId,
    subDepartmentId: row.subDepartmentId,
    designationId: row.designationId,
    gradeId: row.gradeId,
    levelId: row.levelId,
    employeeTypeId: row.employeeTypeId,
    categoryId: row.categoryId,
    unitId: row.unitId,
    locationId: row.locationId,
    costCentreId: row.costCentreId,
    noticePeriodDays: row.noticePeriodDays,
    noticePeriodSource: row.noticePeriodSource,
    changeReason: row.changeReason,
    changeReference: row.changeReference,
  };
}

async function runChangeJob(input: ChangeJobInput, tx: Prisma.TransactionClient): Promise<{ row: JobInfo; previous: JobInfo }> {
  const today = utcDay(input.today ?? new Date());
  const effective = utcDay(input.effectiveFrom);

  const employee = await tx.employee.findFirst({
    where: { id: input.employeeId, companyId: input.companyId, deletedAt: null },
    select: { id: true, lifecycleState: true, reportingManagerId: true, secondReportingManagerId: true },
  });
  if (!employee) throw new JobChangeError('Employee not found', 404);

  if (employee.lifecycleState && BLOCKED_STATES.has(employee.lifecycleState) && !STATE_EXEMPT_REASONS.has(input.changeReason)) {
    throw new JobChangeError(`A job change cannot be initiated for an employee in state ${employee.lifecycleState}`, 409);
  }

  const current = await tx.jobInfo.findFirst({
    where: { employeeId: input.employeeId, effectiveTo: null },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (!current) throw new JobChangeError('Employee has no current job record', 400);

  const joinDay = utcDay(current.joinDate);
  const currentFrom = utcDay(current.effectiveFrom);
  if (effective < joinDay) throw new JobChangeError('Effective date cannot be earlier than the date of joining', 400);
  if (effective < currentFrom) {
    throw new JobChangeError('Effective date cannot be earlier than the effective date of the current job record', 400);
  }

  if (effective < today) {
    const backdatedBy = daysBetweenInclusive(effective, today) - 1;
    if (!input.isAdmin) throw new JobChangeError('Back-dated job changes are permitted to HR Admin only', 403);
    const allowance = backdateAllowanceDays(input.changes, input.reporting);
    if (backdatedBy > allowance) {
      throw new JobChangeError(`Back-dating is limited to ${allowance} days for this change (requested ${backdatedBy})`, 400);
    }
    if (input.changes.noticePeriodDays !== undefined && input.changes.noticePeriodDays !== null) {
      throw new JobChangeError('Notice period changes are forward-dated only', 400);
    }
  }

  // §19: explicit value → OFFER/MANUAL; promotion re-applies the new grade's
  // default; otherwise carry forward, resolving a legacy NULL from grade/policy.
  const { noticePeriodDays: explicitNotice, noticePeriodSource: explicitSource, ...attributeChanges } = input.changes;
  const nextGradeId = attributeChanges.gradeId !== undefined ? attributeChanges.gradeId : current.gradeId;
  let notice: { days: number | null; source: NoticePeriodSource | null };
  if (explicitNotice !== undefined && explicitNotice !== null) {
    notice = { days: explicitNotice, source: explicitSource ?? 'MANUAL' };
  } else if (input.changeReason === 'PROMOTION' && attributeChanges.gradeId !== undefined && attributeChanges.gradeId !== current.gradeId) {
    notice = await resolveNoticePeriod(input.companyId, nextGradeId, null, tx);
  } else if (current.noticePeriodDays !== null) {
    notice = { days: current.noticePeriodDays, source: (current.noticePeriodSource as NoticePeriodSource | null) ?? null };
  } else {
    notice = await resolveNoticePeriod(input.companyId, nextGradeId, null, tx);
  }

  // Reporting line (§17.2 validation).
  let primary = employee.reportingManagerId;
  let secondary = employee.secondReportingManagerId;
  let reportingChanged = false;
  if (input.reporting) {
    if (input.reporting.primaryManagerId !== undefined) primary = input.reporting.primaryManagerId;
    if (input.reporting.secondaryManagerId !== undefined) secondary = input.reporting.secondaryManagerId;
    reportingChanged = primary !== employee.reportingManagerId || secondary !== employee.secondReportingManagerId;
    if (reportingChanged) {
      if (primary === input.employeeId || secondary === input.employeeId) {
        throw new JobChangeError('An employee cannot be their own reporting manager', 400);
      }
      if (primary !== null && secondary !== null && primary === secondary) {
        throw new JobChangeError('Primary and secondary reporting managers must be different people', 400);
      }
      for (const managerId of [primary, secondary]) {
        if (managerId === null) continue;
        const manager = await tx.employee.findFirst({
          where: { id: managerId, companyId: input.companyId, deletedAt: null, isActive: true },
          select: { lifecycleState: true },
        });
        if (!manager) throw new JobChangeError('Reporting manager must be an active employee of the same company', 400);
        if (manager.lifecycleState === 'SEPARATED' || manager.lifecycleState === 'SUSPENDED') {
          throw new JobChangeError(`A ${manager.lifecycleState} employee cannot be assigned as a manager`, 400);
        }
      }
      if (primary !== null && primary !== employee.reportingManagerId && (await wouldCreateCycle(input.employeeId, primary))) {
        throw new JobChangeError('Reporting cycle detected in the primary reporting chain', 400);
      }
    }
  }

  // Full-attribute copy of the open row with the changes applied (§15.2).
  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    effectiveFrom: _ef,
    effectiveTo: _et,
    changeReason: _cr,
    changeReference: _cref,
    noticePeriodDays: _npd,
    noticePeriodSource: _nps,
    ...carried
  } = current;
  void _id; void _c; void _u; void _ef; void _et; void _cr; void _cref; void _npd; void _nps;

  // Same-day second change supersedes the first; the first is retained closed (§18.3).
  const sameDay = effective.getTime() === currentFrom.getTime();
  await tx.jobInfo.update({
    where: { id: current.id },
    data: {
      effectiveTo: addDays(effective, -1),
      ...(sameDay ? { changeReference: `SUPERSEDED ${current.changeReference ?? ''}`.trim().slice(0, 60) } : {}),
    },
  });

  const row = await tx.jobInfo.create({
    data: {
      ...carried,
      ...attributeChanges,
      effectiveFrom: effective,
      effectiveTo: null,
      noticePeriodDays: notice.days,
      noticePeriodSource: notice.source,
      changeReason: input.changeReason,
      changeReference: input.changeReference?.slice(0, 60) ?? null,
    },
  });

  if (reportingChanged) {
    await tx.employee.update({
      where: { id: input.employeeId },
      data: { reportingManagerId: primary, secondReportingManagerId: secondary },
    });
    await recordReportingChange(
      {
        companyId: input.companyId,
        employeeId: input.employeeId,
        primaryManagerId: primary,
        secondaryManagerId: secondary,
        effectiveFrom: effective,
        changeReason: input.changeReason,
        actor: input.actor,
      },
      tx
    );
  }

  await audit(
    {
      companyId: input.companyId,
      entityType: 'JobInfo',
      entityId: row.id,
      entityRef: `employee:${input.employeeId}`,
      action: `JOB_CHANGE:${input.changeReason}`,
      actor: input.actor,
      before: { ...summarise(current), reportingManagerId: employee.reportingManagerId, secondReportingManagerId: employee.secondReportingManagerId },
      after: { ...summarise(row), reportingManagerId: primary, secondReportingManagerId: secondary },
      remark: input.remarks ?? null,
    },
    tx
  );

  return { row, previous: current };
}

/**
 * Record a dated job change. Runs in its own transaction unless `tx` is
 * given, in which case it joins the caller's transaction — and the caller
 * then raises `emitJobChangedEvent` after commit (a subscriber reading the
 * employee inside the open transaction would block on its row lock).
 */
export async function changeJob(input: ChangeJobInput, tx?: Prisma.TransactionClient): Promise<JobInfo> {
  if (tx) return (await runChangeJob(input, tx)).row;
  const result = await prisma.$transaction((t) => runChangeJob(input, t));
  await emitJobChangedEvent(input.companyId, input.employeeId, result.row, input.changeReason, input.changeReference ?? null);
  return result.row;
}

export async function emitJobChangedEvent(
  companyId: number,
  employeeId: number,
  row: Pick<JobInfo, 'id' | 'effectiveFrom'>,
  changeReason: string,
  changeReference: string | null
): Promise<void> {
  await emitPlatformEvent(companyId, 'EMPLOYEE_JOB_CHANGED', {
    moduleCode: 'CORE',
    sourceEntityType: 'JobInfo',
    sourceEntityId: row.id,
    subjectEmpId: employeeId,
    linkPath: `/employees/${employeeId}`,
    data: {
      Job: {
        changeReason,
        effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
        reference: changeReference ?? '',
      },
    },
  });
}

// ─── History listing for the UI ──────────────────────────────────────────────

export async function listJobHistory(companyId: number, employeeId: number) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, companyId, deletedAt: null }, select: { id: true } });
  if (!employee) return null;

  const rows = await prisma.jobInfo.findMany({
    where: { employeeId },
    orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
    include: {
      department: { select: { id: true, name: true } },
      subDepartment: { select: { id: true, name: true } },
      designation: { select: { id: true, name: true } },
      grade: { select: { id: true, name: true } },
      level: { select: { id: true, name: true } },
      employeeType: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true } },
    },
  });

  const locationIds = [...new Set(rows.map((r) => r.locationId).filter((v): v is number => v !== null))];
  const costCentreIds = [...new Set(rows.map((r) => r.costCentreId).filter((v): v is number => v !== null))];
  const [locations, costCentres] = await Promise.all([
    locationIds.length ? prisma.location.findMany({ where: { id: { in: locationIds } }, select: { id: true, code: true, name: true } }) : [],
    costCentreIds.length ? prisma.costCentre.findMany({ where: { id: { in: costCentreIds } }, select: { id: true, code: true, name: true } }) : [],
  ]);
  const locationById = new Map(locations.map((l) => [l.id, l]));
  const costCentreById = new Map(costCentres.map((c) => [c.id, c]));

  return rows.map((r) => ({
    id: r.id,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    isCurrent: r.effectiveTo === null,
    superseded: r.effectiveTo !== null && utcDay(r.effectiveTo) < utcDay(r.effectiveFrom),
    changeReason: r.changeReason,
    changeReference: r.changeReference,
    department: r.department,
    subDepartment: r.subDepartment,
    designation: r.designation,
    grade: r.grade,
    level: r.level,
    employeeType: r.employeeType,
    unit: r.unit,
    location: r.locationId ? (locationById.get(r.locationId) ?? null) : null,
    costCentre: r.costCentreId ? (costCentreById.get(r.costCentreId) ?? null) : null,
    noticePeriodDays: r.noticePeriodDays,
    noticePeriodSource: r.noticePeriodSource,
    joinDate: r.joinDate,
  }));
}
