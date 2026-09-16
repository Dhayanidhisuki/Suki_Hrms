/**
 * Employee lifecycle states and transitions (BRD 01 §8).
 *
 * `Employee.lifecycleState` is the BRD state; the legacy `Employee.status`
 * (active | on-leave | terminated | resigned) is kept for every existing
 * consumer and written alongside it on every transition. Each transition
 * appends one `EmployeeStateTransition` row, an audit row, an activity
 * timeline entry, and raises `EMPLOYEE_STATE_CHANGED`.
 *
 * Only the §8.2 table is permitted; anything else is rejected with
 * "Transition not permitted from <current> to <target>" (a 409 at the API).
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/platform/audit/service';
import { emitPlatformEvent } from '@/lib/platform/events';
import type { PlatformActor } from '@/lib/platform/contracts';
import { logActivity } from '@/lib/activity-log';
import { LIFECYCLE_STATES, type LifecycleState } from '@/lib/validations/employee-master';
import { utcDay } from './resolveJob';

export { LIFECYCLE_STATES };
export type { LifecycleState };

export type LegacyStatus = 'active' | 'on-leave' | 'terminated' | 'resigned';

/** §8.2 — rule number, from (null = creation), to. */
export const TRANSITIONS: ReadonlyArray<{ rule: number; from: LifecycleState | null; to: LifecycleState }> = [
  { rule: 1, from: null, to: 'DRAFT' },
  { rule: 2, from: 'DRAFT', to: 'CANDIDATE_CONVERTED' },
  { rule: 3, from: 'CANDIDATE_CONVERTED', to: 'PROBATION' }, // rule 4 (no-probation type) chains on to CONFIRMED
  { rule: 5, from: 'PROBATION', to: 'CONFIRMED' },
  { rule: 6, from: 'PROBATION', to: 'SEPARATED' },
  { rule: 7, from: 'PROBATION', to: 'ON_NOTICE' },
  { rule: 8, from: 'CONFIRMED', to: 'ON_NOTICE' },
  { rule: 9, from: 'CONFIRMED', to: 'SUSPENDED' },
  { rule: 10, from: 'CONFIRMED', to: 'LONG_LEAVE' },
  { rule: 11, from: 'PROBATION', to: 'LONG_LEAVE' },
  { rule: 12, from: 'LONG_LEAVE', to: 'CONFIRMED' }, // only when the prior state was CONFIRMED
  { rule: 13, from: 'LONG_LEAVE', to: 'PROBATION' }, // only when the prior state was PROBATION
  { rule: 14, from: 'LONG_LEAVE', to: 'SEPARATED' },
  { rule: 15, from: 'SUSPENDED', to: 'CONFIRMED' },
  { rule: 16, from: 'SUSPENDED', to: 'SEPARATED' },
  { rule: 17, from: 'ON_NOTICE', to: 'SEPARATED' },
  { rule: 18, from: 'ON_NOTICE', to: 'CONFIRMED' },
  { rule: 19, from: 'ON_NOTICE', to: 'SUSPENDED' },
  { rule: 20, from: 'SEPARATED', to: 'REHIRED' },
  { rule: 21, from: 'REHIRED', to: 'PROBATION' },
  { rule: 22, from: 'REHIRED', to: 'CONFIRMED' },
];

export function isTransitionAllowed(from: LifecycleState | null, to: LifecycleState): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to);
}

export function allowedTargets(from: LifecycleState | null): LifecycleState[] {
  return TRANSITIONS.filter((t) => t.from === from).map((t) => t.to);
}

/** Legacy `Employee.status` value each state maps to. */
export function legacyStatusFor(state: LifecycleState, current?: string | null): LegacyStatus {
  switch (state) {
    case 'LONG_LEAVE':
      return 'on-leave';
    case 'SEPARATED':
      return current === 'resigned' ? 'resigned' : 'terminated';
    default:
      return 'active';
  }
}

/**
 * State for a row that predates the lifecycle column (backfill and runtime
 * fallback). on-leave → LONG_LEAVE; terminated/resigned → SEPARATED; active →
 * CONFIRMED once a confirmation date exists, PROBATION while a probation end
 * date is recorded without one (that is exactly the Pending Confirmations
 * queue), else CONFIRMED.
 */
export function deriveLifecycleState(input: {
  status: string | null | undefined;
  probationEndDate?: Date | string | null;
  confirmationDate?: Date | string | null;
}): LifecycleState {
  switch (input.status) {
    case 'on-leave':
      return 'LONG_LEAVE';
    case 'terminated':
    case 'resigned':
      return 'SEPARATED';
    default:
      if (input.confirmationDate) return 'CONFIRMED';
      if (input.probationEndDate) return 'PROBATION';
      return 'CONFIRMED';
  }
}

export class TransitionError extends Error {
  status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = 'TransitionError';
    this.status = status;
  }
}

export type TransitionOptions = {
  trigger: string;
  effectiveDate?: Date;
  reason?: string | null;
  referenceNo?: string | null;
  actor: PlatformActor;
  /** Landing state after the transient REHIRED (§8.1); default PROBATION. */
  rehireTo?: 'PROBATION' | 'CONFIRMED';
};

export type TransitionResult = {
  employeeId: number;
  fromState: LifecycleState | null;
  toState: LifecycleState;
  legacyStatus: LegacyStatus;
  steps: Array<{ id: number; fromState: LifecycleState | null; toState: LifecycleState }>;
};

async function runTransition(
  companyId: number,
  employeeId: number,
  toState: LifecycleState,
  opts: TransitionOptions,
  tx: Prisma.TransactionClient
): Promise<TransitionResult> {
  const employee = await tx.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: {
      id: true,
      status: true,
      lifecycleState: true,
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        orderBy: { effectiveFrom: 'desc' },
        select: { probationEndDate: true, confirmationDate: true, probationPeriodMonths: true },
      },
    },
  });
  if (!employee) throw new TransitionError('Employee not found', 404);

  const job = employee.jobInfos[0] ?? null;
  const fromState: LifecycleState | null =
    (employee.lifecycleState as LifecycleState | null) ??
    deriveLifecycleState({ status: employee.status, probationEndDate: job?.probationEndDate, confirmationDate: job?.confirmationDate });

  if (fromState === toState) throw new TransitionError(`Employee is already in state ${toState}`);
  if (!isTransitionAllowed(fromState, toState)) {
    throw new TransitionError(`Transition not permitted from ${fromState ?? '-'} to ${toState}`);
  }

  // Rules 12/13: resuming from LONG_LEAVE returns to the prior state only.
  if (fromState === 'LONG_LEAVE' && (toState === 'CONFIRMED' || toState === 'PROBATION')) {
    const entry = await tx.employeeStateTransition.findFirst({
      where: { employeeId, toState: 'LONG_LEAVE' },
      orderBy: { createdAt: 'desc' },
      select: { fromState: true },
    });
    const prior = (entry?.fromState as LifecycleState | null) ?? 'CONFIRMED';
    if (prior !== toState) {
      throw new TransitionError(`Transition not permitted from LONG_LEAVE to ${toState}: the prior state was ${prior}`);
    }
  }

  // Chained steps performed in the same transaction (§8.1 REHIRED, §8.2 rule 4).
  const chain: LifecycleState[] = [toState];
  if (toState === 'REHIRED') chain.push(opts.rehireTo ?? 'PROBATION');
  if (fromState === 'CANDIDATE_CONVERTED' && toState === 'PROBATION' && job?.probationPeriodMonths === 0) chain.push('CONFIRMED');

  const effectiveDate = utcDay(opts.effectiveDate ?? new Date());
  const steps: TransitionResult['steps'] = [];
  let prev: LifecycleState | null = fromState;
  for (const step of chain) {
    const row = await tx.employeeStateTransition.create({
      data: {
        companyId,
        employeeId,
        fromState: prev,
        toState: step,
        trigger: opts.trigger.slice(0, 40),
        effectiveDate,
        reason: opts.reason?.slice(0, 500) ?? null,
        referenceNo: opts.referenceNo?.slice(0, 60) ?? null,
        performedByUserId: opts.actor.userId ?? null,
      },
      select: { id: true },
    });
    steps.push({ id: row.id, fromState: prev, toState: step });
    prev = step;
  }

  const finalState = chain[chain.length - 1];
  const legacyStatus = legacyStatusFor(finalState, employee.status);
  await tx.employee.update({ where: { id: employeeId }, data: { lifecycleState: finalState, status: legacyStatus } });

  await audit(
    {
      companyId,
      entityType: 'Employee',
      entityId: employeeId,
      action: 'STATE_CHANGE',
      actor: opts.actor,
      before: { lifecycleState: fromState, status: employee.status },
      after: { lifecycleState: finalState, status: legacyStatus },
      remark: [opts.trigger, opts.reason, opts.referenceNo].filter(Boolean).join(' — ') || null,
    },
    tx
  );

  await logActivity(tx, {
    employeeId,
    activityType: 'state_changed',
    module: 'lifecycle',
    performedByUserId: opts.actor.userId ?? null,
    oldValue: { lifecycleState: fromState, status: employee.status },
    newValue: { lifecycleState: finalState, status: legacyStatus },
    remarks: `${fromState ?? '-'} → ${chain.join(' → ')} (${opts.trigger})${opts.reason ? `: ${opts.reason}` : ''}`.slice(0, 500),
    source: opts.actor.source === 'system' ? 'system' : 'web',
  });

  return { employeeId, fromState, toState: finalState, legacyStatus, steps };
}

/**
 * Perform a lifecycle transition. Joins the caller's transaction when `tx`
 * is given, otherwise runs its own. Throws TransitionError (409/404).
 *
 * The EMPLOYEE_STATE_CHANGED event is raised here only when this call owns
 * the transaction: a subscriber reading the employee while the caller's
 * transaction still holds its row lock would block, so a caller that passes
 * `tx` must call `emitTransitionEvent` itself after commit.
 */
export async function transition(
  companyId: number,
  employeeId: number,
  toState: LifecycleState,
  opts: TransitionOptions,
  tx?: Prisma.TransactionClient
): Promise<TransitionResult> {
  if (tx) return runTransition(companyId, employeeId, toState, opts, tx);
  const result = await prisma.$transaction((t) => runTransition(companyId, employeeId, toState, opts, t));
  await emitTransitionEvent(companyId, result, opts);
  return result;
}

export async function emitTransitionEvent(companyId: number, result: TransitionResult, opts: Pick<TransitionOptions, 'trigger' | 'reason' | 'referenceNo'>): Promise<void> {
  const { employeeId } = result;
  await emitPlatformEvent(companyId, 'EMPLOYEE_STATE_CHANGED', {
    moduleCode: 'CORE',
    sourceEntityType: 'Employee',
    sourceEntityId: employeeId,
    subjectEmpId: employeeId,
    linkPath: `/employees/${employeeId}`,
    data: {
      Lifecycle: {
        fromState: result.fromState ?? '',
        toState: result.toState,
        trigger: opts.trigger,
        reason: opts.reason ?? '',
        referenceNo: opts.referenceNo ?? '',
      },
    },
  });
}

/**
 * States a newly created record passes through in the creating transaction
 * (§8.2 rules 1–5). The Recruitment handoff stops at DRAFT; a manual create
 * from the full employee form carries every mandatory field and a confirmed
 * joining, so it runs on to PROBATION, or CONFIRMED when there is no
 * probation (rule 4).
 */
export function creationChain(input: { draftOnly?: boolean; probationMonths?: number | null }): LifecycleState[] {
  if (input.draftOnly) return ['DRAFT'];
  const chain: LifecycleState[] = ['DRAFT', 'CANDIDATE_CONVERTED', 'PROBATION'];
  if (!input.probationMonths) chain.push('CONFIRMED');
  return chain;
}

/** Write the creation chain for a brand-new employee inside the creating transaction. */
export async function initialiseLifecycle(
  companyId: number,
  employeeId: number,
  chain: LifecycleState[],
  opts: { trigger: string; effectiveDate: Date; actor: PlatformActor; reason?: string | null; referenceNo?: string | null },
  tx: Prisma.TransactionClient
): Promise<LifecycleState> {
  let prev: LifecycleState | null = null;
  for (const step of chain) {
    if (!isTransitionAllowed(prev, step)) throw new TransitionError(`Transition not permitted from ${prev ?? '-'} to ${step}`);
    await tx.employeeStateTransition.create({
      data: {
        companyId,
        employeeId,
        fromState: prev,
        toState: step,
        trigger: opts.trigger.slice(0, 40),
        effectiveDate: utcDay(opts.effectiveDate),
        reason: opts.reason?.slice(0, 500) ?? null,
        referenceNo: opts.referenceNo?.slice(0, 60) ?? null,
        performedByUserId: opts.actor.userId ?? null,
      },
    });
    prev = step;
  }
  const finalState = chain[chain.length - 1];
  await tx.employee.update({ where: { id: employeeId }, data: { lifecycleState: finalState, status: legacyStatusFor(finalState) } });
  return finalState;
}

/** Current state (derived for un-backfilled rows) with the targets the API may offer. */
export async function currentLifecycle(companyId: number, employeeId: number) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: {
      status: true,
      lifecycleState: true,
      jobInfos: { where: { effectiveTo: null }, take: 1, select: { probationEndDate: true, confirmationDate: true } },
    },
  });
  if (!employee) return null;
  const job = employee.jobInfos[0] ?? null;
  const stored = employee.lifecycleState as LifecycleState | null;
  const state = stored ?? deriveLifecycleState({ status: employee.status, probationEndDate: job?.probationEndDate, confirmationDate: job?.confirmationDate });
  return { state, derived: stored === null, legacyStatus: employee.status, allowedTargets: allowedTargets(state) };
}

export async function lifecycleHistory(companyId: number, employeeId: number) {
  return prisma.employeeStateTransition.findMany({
    where: { companyId, employeeId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}
