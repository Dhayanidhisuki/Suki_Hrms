/**
 * Workflow & Approval Engine (BRD Part A, §6–§11).
 *
 * One approval mechanism for every module. A module holds a foreign key to
 * a WorkflowRequest and reads status from here; it never keeps approval
 * state of its own. Every verb:
 *   - runs inside one prisma.$transaction,
 *   - re-checks the status it expects with a conditional updateMany and
 *     answers 409 (WF-STALE-409) when another actor committed first (§6.6),
 *   - appends exactly one WorkflowAction row and one audit() row,
 *   - raises platform events after commit (never calls notifications).
 *
 * Slot semantics (see quorum.ts): one matrix line → one slot per resolved
 * approver, all sharing the line's `sequence`; slots sharing a sequence are
 * a pool satisfied by any one holder. Escalation ADD slots join the pool.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '../audit/service';
import { emitPlatformEvent } from '../events';
import { SYSTEM_ACTOR, type ModuleCode, type PlatformActor, type PlatformEventContext } from '../contracts';
import { takeSnapshot } from '../snapshot/service';
import { addBusinessDays, elapsedBusinessDays } from './businessDays';
import { loadMatrixCandidates, loadMatrixLines, selectMatrix } from './matrix';
import { evaluateLevel } from './quorum';
import { getWorkflowHandler } from './registry';
import { resolveApprovers, type ResolutionContext } from './resolve';
import {
  SLOT_STATUS,
  TERMINAL_STATUSES,
  WF_STATUS,
  WorkflowError,
  type CreateDraftInput,
  type RequestContext,
  type ResolvedApprover,
  type WorkflowActionView,
  type WorkflowRequestView,
  type WorkflowSlotView,
} from './types';

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

type RequestRow = Prisma.WorkflowRequestGetPayload<Record<string, never>>;
type SlotRow = Prisma.WorkflowSlotGetPayload<Record<string, never>>;
type LineRow = Prisma.WorkflowMatrixLineGetPayload<Record<string, never>>;
type RequestTypeRow = Prisma.WorkflowRequestTypeGetPayload<Record<string, never>>;
type DelegationRow = Prisma.WorkflowDelegationGetPayload<Record<string, never>>;

export type VerbOptions = {
  /** Caller holds platform.workflow.admin (HR Workflow Administrator). Never grants Approve/Reject/Return (§6.5). */
  asAdmin?: boolean;
};

const TX_OPTS = { maxWait: 10_000, timeout: 30_000 } as const;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MIN_REASON = 10;

// ─── small helpers ───────────────────────────────────────────────────────────

/** Today's IST calendar date as UTC midnight (matches @db.Date columns). */
export function istToday(now = new Date()): Date {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

/** Indian financial year token, e.g. 2526 for 1 Apr 2025 – 31 Mar 2026. */
export function fyToken(now = new Date()): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${String(start % 100).padStart(2, '0')}${String((start + 1) % 100).padStart(2, '0')}`;
}

function parseJson<T>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function toDecimal(v: number | string | Prisma.Decimal | null | undefined): Prisma.Decimal | null {
  if (v === null || v === undefined || v === '') return null;
  try {
    return new Prisma.Decimal(typeof v === 'number' ? v.toString() : v);
  } catch {
    throw new WorkflowError('WF-AMOUNT-400', 'amount is not a valid decimal', 400);
  }
}

function decToNum(v: Prisma.Decimal | null | undefined): number | null {
  return v === null || v === undefined ? null : Number(v.toString());
}

function requireReason(reason: string | null | undefined, code: string, what: string, min = MIN_REASON): string {
  const r = (reason ?? '').trim();
  if (r.length < min) throw new WorkflowError(code, `${what} is mandatory (minimum ${min} characters)`, 400);
  return r;
}

function isRequester(req: RequestRow, actor: PlatformActor): boolean {
  return (actor.employeeId != null && actor.employeeId === req.requesterEmpId) || (actor.userId != null && req.requesterUserId != null && actor.userId === req.requesterUserId);
}

// ─── views ───────────────────────────────────────────────────────────────────

function slotView(s: SlotRow): WorkflowSlotView {
  return {
    id: s.id,
    levelNo: s.levelNo,
    sequence: s.sequence,
    parallelGroup: s.parallelGroup,
    approverType: s.approverType,
    approverRef: s.approverRef,
    resolvedEmpId: s.resolvedEmpId,
    resolvedUserId: s.resolvedUserId,
    isMandatory: s.isMandatory,
    quorumRule: s.quorumRule,
    quorumN: s.quorumN,
    status: s.status,
    escalationHop: s.escalationHop,
    actedByEmpId: s.actedByEmpId,
    actedByUserId: s.actedByUserId,
    onBehalfOfEmpId: s.onBehalfOfEmpId,
    delegationId: s.delegationId,
    actedAt: s.actedAt,
    remark: s.remark,
  };
}

function actionView(a: Prisma.WorkflowActionGetPayload<Record<string, never>>): WorkflowActionView {
  return {
    id: a.id,
    verb: a.verb,
    fromStatus: a.fromStatus,
    toStatus: a.toStatus,
    levelNo: a.levelNo,
    actorUserId: a.actorUserId,
    actorEmpId: a.actorEmpId,
    onBehalfOfEmpId: a.onBehalfOfEmpId,
    delegationId: a.delegationId,
    remark: a.remark,
    detail: parseJson(a.detailJson),
    createdAt: a.createdAt,
  };
}

export function toRequestView(r: RequestRow, slots: SlotRow[] = [], actions: Prisma.WorkflowActionGetPayload<Record<string, never>>[] = []): WorkflowRequestView {
  return {
    id: r.id,
    companyId: r.companyId,
    requestNo: r.requestNo,
    requestTypeCode: r.requestTypeCode,
    moduleCode: r.moduleCode,
    sourceEntityType: r.sourceEntityType,
    sourceEntityId: r.sourceEntityId,
    title: r.title,
    requesterEmpId: r.requesterEmpId,
    requesterUserId: r.requesterUserId,
    subjectEmpId: r.subjectEmpId,
    onBehalfOfEmpId: r.onBehalfOfEmpId,
    amount: r.amount ? r.amount.toString() : null,
    requestSubType: r.requestSubType,
    priority: r.priority,
    payload: parseJson(r.payloadJson),
    context: parseJson<RequestContext>(r.contextJson),
    currentStatus: r.currentStatus,
    currentLevel: r.currentLevel,
    matrixId: r.matrixId,
    matrixVersionNo: r.matrixVersionNo,
    snapshotId: r.snapshotId,
    levelEnteredAt: r.levelEnteredAt,
    dueAt: r.dueAt,
    slaBreachCount: r.slaBreachCount,
    escalationExhausted: r.escalationExhausted,
    submittedAt: r.submittedAt,
    decidedAt: r.decidedAt,
    decisionRemark: r.decisionRemark,
    validationErrors: parseJson<string[]>(r.validationErrorsJson),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    slots: slots.map(slotView),
    actions: actions.map(actionView),
  };
}

async function loadView(db: Db, companyId: number, id: number): Promise<WorkflowRequestView> {
  const r = await db.workflowRequest.findFirst({ where: { id, companyId } });
  if (!r) throw new WorkflowError('WF-404', 'Request not found', 404);
  const [slots, actions] = await Promise.all([
    db.workflowSlot.findMany({ where: { requestId: id }, orderBy: [{ levelNo: 'asc' }, { sequence: 'asc' }, { id: 'asc' }] }),
    db.workflowAction.findMany({ where: { requestId: id, companyId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
  ]);
  return toRequestView(r, slots, actions);
}

// ─── context / matrix binding ────────────────────────────────────────────────

/** Resolve the §7.2 condition values from the subject employee's current JobInfo. */
export async function buildRequestContext(
  db: Db,
  companyId: number,
  subjectEmpId: number | null,
  amount: Prisma.Decimal | null,
  requestSubType: string | null,
): Promise<RequestContext> {
  const ctx: RequestContext = {
    amount: decToNum(amount),
    requestSubType: requestSubType ?? null,
    subjectEmpId,
    designationCode: null,
    departmentCode: null,
    gradeCode: null,
    employmentType: null,
    locationCode: null,
    costCentreCode: null, // no cost-centre master on JobInfo yet
    departmentId: null,
    designationId: null,
  };
  if (!subjectEmpId) return ctx;
  const job = await db.jobInfo.findFirst({
    where: { employeeId: subjectEmpId, effectiveTo: null, employee: { companyId } },
    orderBy: { effectiveFrom: 'desc' },
    select: {
      departmentId: true,
      designationId: true,
      department: { select: { code: true } },
      designation: { select: { code: true } },
      grade: { select: { code: true } },
      employeeType: { select: { code: true } },
      unit: { select: { code: true } },
    },
  });
  if (!job) return ctx;
  ctx.departmentId = job.departmentId;
  ctx.designationId = job.designationId;
  ctx.departmentCode = job.department?.code ?? null;
  ctx.designationCode = job.designation?.code ?? null;
  ctx.gradeCode = job.grade?.code ?? null;
  ctx.employmentType = job.employeeType?.code ?? null;
  ctx.locationCode = job.unit?.code ?? null;
  return ctx;
}

const CONDITION_KEYS: (keyof RequestContext)[] = [
  'amount',
  'designationCode',
  'departmentCode',
  'gradeCode',
  'employmentType',
  'locationCode',
  'costCentreCode',
  'requestSubType',
];

function conditionFingerprint(ctx: RequestContext | null): string {
  if (!ctx) return '';
  return JSON.stringify(CONDITION_KEYS.map((k) => (ctx[k] ?? null)));
}

async function loadRequestType(db: Db, companyId: number, code: string): Promise<RequestTypeRow> {
  const rt = await db.workflowRequestType.findFirst({ where: { companyId, code, isActive: true } });
  if (!rt) throw new WorkflowError('WF-TYPE-404', `Request type ${code} is not registered for this company`, 404);
  return rt;
}

async function allocateRequestNo(tx: Tx, companyId: number, typeCode: string, now: Date): Promise<string> {
  const prefix = `${typeCode}/${fyToken(now)}/`;
  const last = await tx.workflowRequest.findFirst({
    where: { companyId, requestNo: { startsWith: prefix } },
    orderBy: { requestNo: 'desc' },
    select: { requestNo: true },
  });
  const serial = last ? Number(last.requestNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(serial) ? serial : 1).padStart(6, '0')}`;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

// ─── actions / audit ─────────────────────────────────────────────────────────

type ActionInput = {
  verb: string;
  fromStatus: string | null;
  toStatus: string;
  levelNo?: number | null;
  actor: PlatformActor;
  onBehalfOfEmpId?: number | null;
  delegationId?: number | null;
  remark?: string | null;
  detail?: unknown;
};

async function writeAction(tx: Tx, req: RequestRow, a: ActionInput): Promise<void> {
  await tx.workflowAction.create({
    data: {
      companyId: req.companyId,
      requestId: req.id,
      verb: a.verb,
      fromStatus: a.fromStatus,
      toStatus: a.toStatus,
      levelNo: a.levelNo ?? null,
      actorUserId: a.actor.userId ?? null,
      actorEmpId: a.actor.employeeId ?? null,
      onBehalfOfEmpId: a.onBehalfOfEmpId ?? null,
      delegationId: a.delegationId ?? null,
      remark: a.remark ? a.remark.slice(0, 1000) : null,
      detailJson: a.detail === undefined ? null : JSON.stringify(a.detail),
    },
  });
  await audit(
    {
      companyId: req.companyId,
      entityType: 'WorkflowRequest',
      entityId: req.id,
      entityRef: req.requestNo,
      action: a.verb.toUpperCase(),
      actor: { ...a.actor, onBehalfOfEmployeeId: a.onBehalfOfEmpId ?? a.actor.onBehalfOfEmployeeId ?? null },
      before: { currentStatus: a.fromStatus, currentLevel: req.currentLevel },
      after: { currentStatus: a.toStatus, currentLevel: a.levelNo ?? req.currentLevel, ...(a.detail && typeof a.detail === 'object' ? (a.detail as object) : {}) },
      remark: a.remark ?? null,
    },
    tx,
  );
}

/** Conditional status transition — the optimistic-concurrency guard of §6.6. */
async function transition(tx: Tx, req: RequestRow, fromStatus: string, data: Prisma.WorkflowRequestUpdateManyMutationInput): Promise<void> {
  const { count } = await tx.workflowRequest.updateMany({ where: { id: req.id, companyId: req.companyId, currentStatus: fromStatus }, data });
  if (count === 0) throw new WorkflowError('WF-STALE-409', 'The request was changed by another action first; reload and retry', 409);
}

// ─── level entry ─────────────────────────────────────────────────────────────

type LevelEntry = { status: 'pending'; level: number; dueAt: Date | null } | { status: 'approved' };

async function computeDueAt(companyId: number, pending: SlotRow[], levelLines: LineRow[], priority: string, from: Date): Promise<Date | null> {
  if (pending.length === 0) return null;
  const slaDays = levelLines.reduce((m, l) => Math.max(m, Number(l.escalationDays.toString())), 0) || 2;
  const factor = priority === 'URGENT' ? 0.5 : 1;
  const holders = [...new Set(pending.map((s) => s.resolvedEmpId))];
  let latest: Date | null = null;
  for (const empId of holders) {
    const due = await addBusinessDays(companyId, empId, from, slaDays * factor);
    if (!latest || due.getTime() > latest.getTime()) latest = due;
  }
  return latest;
}

/**
 * Materialise the slots of one level. Returns the created slots.
 * skipIfSameAsRequester → Skipped; nobody resolved → Vacant.
 */
async function materialiseLevel(tx: Tx, req: RequestRow, lines: LineRow[], levelNo: number): Promise<SlotRow[]> {
  const levelLines = lines.filter((l) => l.levelNo === levelNo);
  const rctx: ResolutionContext = { requesterEmpId: req.requesterEmpId, subjectEmpId: req.subjectEmpId };
  const created: SlotRow[] = [];
  for (const line of levelLines) {
    const base = {
      requestId: req.id,
      levelNo,
      sequence: line.sequence,
      parallelGroup: line.parallelGroup,
      approverType: line.approverType,
      approverRef: line.approverRef,
      isMandatory: line.mandatory,
      quorumRule: line.quorumRule,
      quorumN: line.quorumN,
      escalationHop: 0,
    };
    const approvers = await resolveApprovers(tx, req.companyId, line.approverType, line.approverRef, rctx);
    if (approvers.length === 0) {
      created.push(await tx.workflowSlot.create({ data: { ...base, status: SLOT_STATUS.Vacant, remark: 'No approver resolved' } }));
      continue;
    }
    for (const a of approvers) {
      const same = a.empId !== null && a.empId === req.requesterEmpId;
      if (same && line.skipIfSameAsRequester) {
        created.push(
          await tx.workflowSlot.create({
            data: { ...base, resolvedEmpId: a.empId, resolvedUserId: a.userId, status: SLOT_STATUS.Skipped, remark: 'Approver is the requester (skipIfSameAsRequester)' },
          }),
        );
        continue;
      }
      created.push(await tx.workflowSlot.create({ data: { ...base, resolvedEmpId: a.empId, resolvedUserId: a.userId, status: SLOT_STATUS.Pending } }));
    }
  }
  return created;
}

/**
 * Enter `startLevel` and keep advancing through auto-satisfied levels
 * (every mandatory slot Skipped/Vacant). Sets the request's level fields.
 */
async function enterLevels(tx: Tx, req: RequestRow, lines: LineRow[], startLevel: number, actor: PlatformActor, now: Date): Promise<LevelEntry> {
  const maxLevel = lines.reduce((m, l) => Math.max(m, l.levelNo), 0);
  for (let level = startLevel; level <= maxLevel; level++) {
    const slots = await materialiseLevel(tx, req, lines, level);
    const ev = evaluateLevel(slots);
    const pending = slots.filter((s) => s.status === SLOT_STATUS.Pending);
    if (ev.satisfied && pending.length === 0) {
      await writeAction(tx, req, {
        verb: 'AutoSatisfy',
        fromStatus: WF_STATUS.PendingApproval,
        toStatus: WF_STATUS.PendingApproval,
        levelNo: level,
        actor: SYSTEM_ACTOR,
        remark: slots.length === 0 ? 'Level has no lines' : 'Every mandatory slot skipped or vacant — level auto-satisfied',
        detail: { autoSatisfied: true, slots: slots.map((s) => ({ ref: s.approverRef, status: s.status })) },
      });
      continue;
    }
    const levelLines = lines.filter((l) => l.levelNo === level);
    const dueAt = await computeDueAt(req.companyId, pending, levelLines, req.priority, now);
    await tx.workflowRequest.update({
      where: { id: req.id },
      data: { currentStatus: WF_STATUS.PendingApproval, currentLevel: level, levelEnteredAt: now, dueAt, slaBreachCount: 0, escalationExhausted: false },
    });
    void actor;
    return { status: 'pending', level, dueAt };
  }
  return { status: 'approved' };
}

async function finishApproved(tx: Tx, req: RequestRow, fromStatus: string, actor: PlatformActor, remark: string | null, extra?: Record<string, unknown>): Promise<void> {
  const now = new Date();
  await tx.workflowRequest.update({
    where: { id: req.id },
    data: { currentStatus: WF_STATUS.Approved, decidedAt: now, decisionRemark: remark, dueAt: null },
  });
  await writeAction(tx, req, { verb: 'Complete', fromStatus, toStatus: WF_STATUS.Approved, levelNo: req.currentLevel, actor, remark, detail: { finalLevelSatisfied: true, ...extra } });
}

// ─── post-commit side effects ────────────────────────────────────────────────

function eventCtx(view: WorkflowRequestView, extra: Partial<PlatformEventContext> = {}): PlatformEventContext {
  return {
    moduleCode: view.moduleCode as ModuleCode,
    sourceEntityType: view.sourceEntityType,
    sourceEntityId: view.sourceEntityId,
    subjectEmpId: view.subjectEmpId ?? view.requesterEmpId,
    requesterEmpId: view.requesterEmpId,
    requestId: view.id,
    linkPath: `/approvals/inbox/${view.id}`,
    priority: view.priority === 'URGENT' ? 'URGENT' : undefined,
    data: {
      Request: {
        No: view.requestNo,
        Type: view.requestTypeCode,
        Title: view.title,
        Status: view.currentStatus,
        Level: view.currentLevel,
        Amount: view.amount,
        DueAt: view.dueAt,
      },
    },
    ...extra,
  };
}

async function afterCommit(view: WorkflowRequestView, effects: { event?: { code: string; recipients: string[]; priority?: 'URGENT' | 'NORMAL' | 'LOW' }; onApproved?: string | null; onRejected?: { handlerKey: string | null; reason: string } }) {
  if (effects.onApproved !== undefined) {
    const h = getWorkflowHandler(effects.onApproved);
    if (h?.onApproved) {
      try {
        await h.onApproved(view);
      } catch (err) {
        console.error(`[platform/workflow] onApproved handler failed for ${view.requestNo}:`, err);
      }
    }
  }
  if (effects.onRejected) {
    const h = getWorkflowHandler(effects.onRejected.handlerKey);
    if (h?.onRejected) {
      try {
        await h.onRejected(view, effects.onRejected.reason);
      } catch (err) {
        console.error(`[platform/workflow] onRejected handler failed for ${view.requestNo}:`, err);
      }
    }
  }
  if (effects.event) {
    await emitPlatformEvent(view.companyId, effects.event.code, eventCtx(view, { recipients: effects.event.recipients, ...(effects.event.priority ? { priority: effects.event.priority } : {}) }));
  }
}

// ─── verbs ───────────────────────────────────────────────────────────────────

export async function createDraft(input: CreateDraftInput): Promise<WorkflowRequestView> {
  const now = new Date();
  const amount = toDecimal(input.amount);
  const requestType = await loadRequestType(prisma, input.companyId, input.requestTypeCode);

  const requester = await prisma.employee.findFirst({ where: { id: input.requesterEmpId, companyId: input.companyId, deletedAt: null }, select: { id: true, userId: true } });
  if (!requester) throw new WorkflowError('WF-REQUESTER-404', 'Requester employee not found in this company', 404);
  if (input.subjectEmpId) {
    const subject = await prisma.employee.findFirst({ where: { id: input.subjectEmpId, companyId: input.companyId, deletedAt: null }, select: { id: true } });
    if (!subject) throw new WorkflowError('WF-SUBJECT-404', 'Subject employee not found in this company', 404);
  }

  const context = await buildRequestContext(prisma, input.companyId, input.subjectEmpId ?? input.requesterEmpId, amount, input.requestSubType ?? null);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const id = await prisma.$transaction(async (tx) => {
        const requestNo = await allocateRequestNo(tx, input.companyId, requestType.code, now);
        const row = await tx.workflowRequest.create({
          data: {
            companyId: input.companyId,
            requestNo,
            requestTypeCode: requestType.code,
            moduleCode: requestType.moduleCode,
            sourceEntityType: input.sourceEntityType,
            sourceEntityId: input.sourceEntityId,
            title: input.title.slice(0, 200),
            requesterEmpId: input.requesterEmpId,
            requesterUserId: input.actor.userId ?? requester.userId ?? null,
            subjectEmpId: input.subjectEmpId ?? null,
            onBehalfOfEmpId: input.onBehalfOfEmpId ?? null,
            amount,
            requestSubType: input.requestSubType ?? null,
            priority: input.priority ?? 'NORMAL',
            payloadJson: input.payload === undefined ? null : JSON.stringify(input.payload),
            contextJson: JSON.stringify(context),
            currentStatus: WF_STATUS.Draft,
            currentLevel: 0,
            createdByUserId: input.actor.userId ?? null,
          },
        });
        await writeAction(tx, row, { verb: 'Create', fromStatus: null, toStatus: WF_STATUS.Draft, actor: input.actor, detail: { requestNo } });
        return row.id;
      }, TX_OPTS);
      return loadView(prisma, input.companyId, id);
    } catch (err) {
      if (isUniqueViolation(err) && attempt < 4) continue; // requestNo raced — reallocate
      throw err;
    }
  }
  throw new WorkflowError('WF-REQNO-409', 'Could not allocate a request number', 409);
}

/** Edit an editable request (Draft / Validation Failed / Returned) — requester only. */
export async function updateDraft(
  companyId: number,
  requestId: number,
  actor: PlatformActor,
  patch: { title?: string; payload?: unknown; amount?: number | string | null; requestSubType?: string | null; priority?: 'URGENT' | 'NORMAL' | 'LOW'; subjectEmpId?: number | null },
  opts: VerbOptions = {},
): Promise<WorkflowRequestView> {
  await prisma.$transaction(async (tx) => {
    const req = await tx.workflowRequest.findFirst({ where: { id: requestId, companyId } });
    if (!req) throw new WorkflowError('WF-404', 'Request not found', 404);
    if (!isRequester(req, actor) && !opts.asAdmin) throw new WorkflowError('WF-FORBIDDEN-403', 'Only the requester may edit this request', 403);
    const editable = new Set<string>([WF_STATUS.Draft, WF_STATUS.ValidationFailed, WF_STATUS.Returned]);
    if (!editable.has(req.currentStatus)) throw new WorkflowError('WF-STATE-409', `Request is ${req.currentStatus}; not editable`, 409);

    const data: Prisma.WorkflowRequestUpdateManyMutationInput = {};
    if (patch.title !== undefined) data.title = patch.title.slice(0, 200);
    if (patch.payload !== undefined) data.payloadJson = JSON.stringify(patch.payload);
    if (patch.amount !== undefined) data.amount = toDecimal(patch.amount);
    if (patch.requestSubType !== undefined) data.requestSubType = patch.requestSubType;
    if (patch.priority !== undefined) data.priority = patch.priority;
    if (patch.subjectEmpId !== undefined) data.subjectEmpId = patch.subjectEmpId;
    if (patch.amount !== undefined || patch.requestSubType !== undefined || patch.subjectEmpId !== undefined) {
      const subject = patch.subjectEmpId !== undefined ? patch.subjectEmpId : req.subjectEmpId;
      const amount = patch.amount !== undefined ? toDecimal(patch.amount) : req.amount;
      const sub = patch.requestSubType !== undefined ? patch.requestSubType : req.requestSubType;
      data.contextJson = JSON.stringify(await buildRequestContext(tx, companyId, subject ?? req.requesterEmpId, amount, sub));
    }
    await transition(tx, req, req.currentStatus, data);
    await writeAction(tx, req, { verb: 'Update', fromStatus: req.currentStatus, toStatus: req.currentStatus, actor, detail: { fields: Object.keys(data) } });
  }, TX_OPTS);
  return loadView(prisma, companyId, requestId);
}

/**
 * Submit: validate → snapshot → select and bind matrix → materialise level 1.
 */
export async function submit(companyId: number, requestId: number, actor: PlatformActor, opts: VerbOptions = {}): Promise<WorkflowRequestView> {
  const now = new Date();
  let effects: Parameters<typeof afterCommit>[1] = {};

  await prisma.$transaction(async (tx) => {
    const req = await tx.workflowRequest.findFirst({ where: { id: requestId, companyId } });
    if (!req) throw new WorkflowError('WF-404', 'Request not found', 404);
    if (![WF_STATUS.Draft, WF_STATUS.ValidationFailed].includes(req.currentStatus as never)) {
      throw new WorkflowError('WF-STATE-409', `Request is ${req.currentStatus}; only Draft or Validation Failed may be submitted`, 409);
    }
    if (!isRequester(req, actor) && !opts.asAdmin) throw new WorkflowError('WF-FORBIDDEN-403', 'Only the requester may submit this request', 403);
    const requestType = await loadRequestType(tx, companyId, req.requestTypeCode);

    // Move to the transient Submitted status (this is also the concurrency guard).
    await transition(tx, req, req.currentStatus, { currentStatus: WF_STATUS.Submitted });
    const fromStatus = req.currentStatus;

    // Refresh the condition values at the instant of submit (§5.3).
    const context = await buildRequestContext(tx, companyId, req.subjectEmpId ?? req.requesterEmpId, req.amount, req.requestSubType);

    // Validate through the registered handler; absent handler = pass.
    const handler = getWorkflowHandler(requestType.handlerKey);
    if (handler?.validate) {
      const result = await handler.validate(toRequestView({ ...req, contextJson: JSON.stringify(context) }));
      if (!result.ok) {
        await tx.workflowRequest.update({
          where: { id: req.id },
          data: { currentStatus: WF_STATUS.ValidationFailed, validationErrorsJson: JSON.stringify(result.errors), contextJson: JSON.stringify(context) },
        });
        await writeAction(tx, req, { verb: 'Validate', fromStatus: WF_STATUS.Submitted, toStatus: WF_STATUS.ValidationFailed, actor: SYSTEM_ACTOR, detail: { errors: result.errors } });
        return;
      }
    }

    // Snapshot binding (§6.4 Submit, §19).
    let snapshotId: number | null = req.snapshotId;
    if (requestType.snapshotTypeCode && !snapshotId) {
      const snap = await takeSnapshot(
        {
          companyId,
          snapshotTypeCode: requestType.snapshotTypeCode,
          sourceEntityType: req.sourceEntityType,
          sourceEntityId: req.sourceEntityId,
          content: parseJson(req.payloadJson) ?? {},
          actor,
          triggerRequestId: req.id,
          note: `Bound at submit of ${req.requestNo}`,
        },
        tx,
      );
      snapshotId = snap.id;
    }

    // Matrix selection and binding (§7.5 / §7.6).
    const candidates = await loadMatrixCandidates(tx, companyId, req.requestTypeCode);
    const selection = selectMatrix(candidates, context, now);
    const lines = await loadMatrixLines(tx, selection.matrix.id);
    if (lines.length === 0) throw new WorkflowError('WF-MATRIX-EMPTY-422', `Matrix ${selection.matrix.code} v${selection.matrix.versionNo} has no lines`, 422);

    await tx.workflowRequest.update({
      where: { id: req.id },
      data: {
        matrixId: selection.matrix.id,
        matrixVersionNo: selection.matrix.versionNo,
        snapshotId,
        contextJson: JSON.stringify(context),
        validationErrorsJson: null,
        submittedAt: req.submittedAt ?? now,
        currentStatus: WF_STATUS.PendingApproval,
      },
    });
    const bound = { ...req, submittedAt: req.submittedAt ?? now, matrixId: selection.matrix.id, matrixVersionNo: selection.matrix.versionNo, snapshotId };
    await writeAction(tx, bound, {
      verb: 'Submit',
      fromStatus,
      toStatus: WF_STATUS.PendingApproval,
      levelNo: 1,
      actor,
      detail: { matrixCode: selection.matrix.code, matrixVersionNo: selection.matrix.versionNo, score: selection.score, viaFallback: selection.viaFallback, snapshotId },
    });

    const entry = await enterLevels(tx, bound, lines, 1, actor, now);
    if (entry.status === 'approved') {
      await finishApproved(tx, { ...bound, currentLevel: 0 }, WF_STATUS.PendingApproval, SYSTEM_ACTOR, 'Every level auto-satisfied at submit');
      effects = { onApproved: requestType.handlerKey, event: { code: 'WF_APPROVED', recipients: ['REQUESTER', 'SUBJECT_EMPLOYEE'] } };
    } else {
      effects = { event: { code: 'WF_PENDING_APPROVAL', recipients: ['CURRENT_APPROVERS'] } };
    }
  }, TX_OPTS);

  const view = await loadView(prisma, companyId, requestId);
  await afterCommit(view, effects);
  return view;
}

// ─── slot lookup for approve / reject / return ──────────────────────────────

type ActorSlot = { slot: SlotRow; delegation: DelegationRow | null };

function scopeMatches(d: DelegationRow, req: RequestRow): boolean {
  if (d.scopeType === 'ALL') return true;
  const refs = (d.scopeRefList ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (d.scopeType === 'MODULE') return refs.includes(req.moduleCode.toUpperCase());
  if (d.scopeType === 'REQUEST_TYPE') return refs.includes(req.requestTypeCode.toUpperCase());
  return false;
}

function ceilingAllows(d: DelegationRow, req: RequestRow): boolean {
  if (!d.amountCeiling) return true;
  if (!req.amount) return true;
  return req.amount.lte(d.amountCeiling);
}

/** Delegations under which `delegateEmpId` may act today. */
async function activeDelegationsFor(db: Db, companyId: number, delegateEmpId: number, today: Date): Promise<DelegationRow[]> {
  return db.workflowDelegation.findMany({
    where: { companyId, delegateEmpId, status: 'Active', fromDate: { lte: today }, toDate: { gte: today } },
  });
}

/**
 * Find the Pending slot at the current level the actor may act on: their
 * own slot first; otherwise a delegator's slot under an active delegation
 * (§8.3 rules 1, 2, 6, 8 applied here; 3/4 at delegation save).
 */
async function findActorSlot(tx: Tx, req: RequestRow, requestType: RequestTypeRow, actor: PlatformActor): Promise<ActorSlot | null> {
  const pending = await tx.workflowSlot.findMany({ where: { requestId: req.id, levelNo: req.currentLevel, status: SLOT_STATUS.Pending }, orderBy: [{ sequence: 'asc' }, { id: 'asc' }] });
  const own = pending.find((s) => (actor.employeeId != null && s.resolvedEmpId === actor.employeeId) || (actor.userId != null && s.resolvedUserId != null && s.resolvedUserId === actor.userId));
  if (own) return { slot: own, delegation: null }; // rule 8: a holder acts on their own slot

  if (!actor.employeeId || !requestType.allowDelegation) return null;
  if (actor.employeeId === req.requesterEmpId) return null; // rule 1: a delegate never acts on their own request
  const delegations = await activeDelegationsFor(tx, req.companyId, actor.employeeId, istToday());
  for (const d of delegations) {
    if (d.delegatorEmpId === d.delegateEmpId) continue; // rule 2
    if (!scopeMatches(d, req) || !ceilingAllows(d, req)) continue; // rule 6
    if (!d.includeInFlight && req.submittedAt && req.submittedAt.getTime() < d.fromDate.getTime()) continue;
    const slot = pending.find((s) => s.resolvedEmpId === d.delegatorEmpId);
    if (slot) return { slot, delegation: d };
  }
  return null;
}

type Decision = 'Approved' | 'Rejected' | 'Returned';

async function decideSlot(tx: Tx, found: ActorSlot, actor: PlatformActor, status: Decision, remark: string | null): Promise<void> {
  const { count } = await tx.workflowSlot.updateMany({
    where: { id: found.slot.id, status: SLOT_STATUS.Pending },
    data: {
      status,
      actedByEmpId: actor.employeeId ?? null,
      actedByUserId: actor.userId ?? null,
      onBehalfOfEmpId: found.delegation ? found.delegation.delegatorEmpId : null,
      delegationId: found.delegation?.id ?? null,
      actedAt: new Date(),
      remark: remark ? remark.slice(0, 500) : null,
    },
  });
  if (count === 0) throw new WorkflowError('WF-STALE-409', 'This slot was already actioned by another approver', 409);
}

async function loadPendingRequest(tx: Tx, companyId: number, requestId: number): Promise<{ req: RequestRow; requestType: RequestTypeRow }> {
  const req = await tx.workflowRequest.findFirst({ where: { id: requestId, companyId } });
  if (!req) throw new WorkflowError('WF-404', 'Request not found', 404);
  if (req.currentStatus !== WF_STATUS.PendingApproval) throw new WorkflowError('WF-STATE-409', `Request is ${req.currentStatus}; not pending approval`, 409);
  const requestType = await loadRequestType(tx, companyId, req.requestTypeCode);
  return { req, requestType };
}

export async function approve(companyId: number, requestId: number, actor: PlatformActor, remark?: string): Promise<WorkflowRequestView> {
  const now = new Date();
  let effects: Parameters<typeof afterCommit>[1] = {};
  const trimmed = (remark ?? '').trim() || null;

  await prisma.$transaction(async (tx) => {
    const { req, requestType } = await loadPendingRequest(tx, companyId, requestId);
    const found = await findActorSlot(tx, req, requestType, actor);
    if (!found) throw new WorkflowError('WF-FORBIDDEN-403', 'You do not hold a pending approval slot on this request at its current level', 403);
    if (!trimmed && requestType.remarkMandatoryOnApprove) throw new WorkflowError('WF-REMARK-400', 'A remark is mandatory on approval for this request type', 400);
    if (!trimmed && req.matrixId) {
      const line = await tx.workflowMatrixLine.findFirst({ where: { matrixId: req.matrixId, levelNo: req.currentLevel, sequence: found.slot.sequence, remarkMandatory: true }, select: { id: true } });
      if (line) throw new WorkflowError('WF-REMARK-400', 'A remark is mandatory on approval at this level', 400);
    }

    await decideSlot(tx, found, actor, 'Approved', trimmed);
    const levelSlots = await tx.workflowSlot.findMany({ where: { requestId: req.id, levelNo: req.currentLevel } });
    const ev = evaluateLevel(levelSlots);

    await writeAction(tx, req, {
      verb: 'Approve',
      fromStatus: WF_STATUS.PendingApproval,
      toStatus: WF_STATUS.PendingApproval,
      levelNo: req.currentLevel,
      actor,
      onBehalfOfEmpId: found.delegation?.delegatorEmpId ?? null,
      delegationId: found.delegation?.id ?? null,
      remark: trimmed,
      detail: { slotId: found.slot.id, levelSatisfied: ev.satisfied },
    });

    if (!ev.satisfied) {
      effects = {};
      return;
    }
    const lines = await loadMatrixLines(tx, req.matrixId!);
    const entry = await enterLevels(tx, req, lines, req.currentLevel + 1, actor, now);
    if (entry.status === 'approved') {
      await finishApproved(tx, req, WF_STATUS.PendingApproval, actor, trimmed);
      effects = { onApproved: requestType.handlerKey, event: { code: 'WF_APPROVED', recipients: ['REQUESTER', 'SUBJECT_EMPLOYEE'] } };
    } else {
      effects = { event: { code: 'WF_PENDING_APPROVAL', recipients: ['CURRENT_APPROVERS'] } };
    }
  }, TX_OPTS);

  const view = await loadView(prisma, companyId, requestId);
  await afterCommit(view, effects);
  return view;
}

export async function reject(companyId: number, requestId: number, actor: PlatformActor, reason: string): Promise<WorkflowRequestView> {
  const r = requireReason(reason, 'WF-REASON-400', 'Rejection reason');
  let effects: Parameters<typeof afterCommit>[1] = {};

  await prisma.$transaction(async (tx) => {
    const { req, requestType } = await loadPendingRequest(tx, companyId, requestId);
    const found = await findActorSlot(tx, req, requestType, actor);
    if (!found) throw new WorkflowError('WF-FORBIDDEN-403', 'You do not hold a pending approval slot on this request at its current level', 403);

    await decideSlot(tx, found, actor, 'Rejected', r);
    await transition(tx, req, WF_STATUS.PendingApproval, { currentStatus: WF_STATUS.Rejected, decidedAt: new Date(), decisionRemark: r, dueAt: null });
    await writeAction(tx, req, {
      verb: 'Reject',
      fromStatus: WF_STATUS.PendingApproval,
      toStatus: WF_STATUS.Rejected,
      levelNo: req.currentLevel,
      actor,
      onBehalfOfEmpId: found.delegation?.delegatorEmpId ?? null,
      delegationId: found.delegation?.id ?? null,
      remark: r,
      detail: { slotId: found.slot.id },
    });
    effects = { onRejected: { handlerKey: requestType.handlerKey, reason: r }, event: { code: 'WF_REJECTED', recipients: ['REQUESTER', 'SUBJECT_EMPLOYEE'] } };
  }, TX_OPTS);

  const view = await loadView(prisma, companyId, requestId);
  await afterCommit(view, effects);
  return view;
}

export async function returnForCorrection(companyId: number, requestId: number, actor: PlatformActor, reason: string): Promise<WorkflowRequestView> {
  const r = requireReason(reason, 'WF-REASON-400', 'Return reason', 1);
  let effects: Parameters<typeof afterCommit>[1] = {};

  await prisma.$transaction(async (tx) => {
    const { req, requestType } = await loadPendingRequest(tx, companyId, requestId);
    if (!requestType.allowReturn) throw new WorkflowError('WF-RETURN-403', 'Return for correction is not permitted for this request type', 403);
    const found = await findActorSlot(tx, req, requestType, actor);
    if (!found) throw new WorkflowError('WF-FORBIDDEN-403', 'You do not hold a pending approval slot on this request at its current level', 403);

    await decideSlot(tx, found, actor, 'Returned', r);
    // SLA paused: dueAt cleared; level retained so approvals at earlier levels survive (§11.3).
    await transition(tx, req, WF_STATUS.PendingApproval, { currentStatus: WF_STATUS.Returned, dueAt: null, decisionRemark: r });
    await writeAction(tx, req, {
      verb: 'Return',
      fromStatus: WF_STATUS.PendingApproval,
      toStatus: WF_STATUS.Returned,
      levelNo: req.currentLevel,
      actor,
      onBehalfOfEmpId: found.delegation?.delegatorEmpId ?? null,
      delegationId: found.delegation?.id ?? null,
      remark: r,
      detail: { slotId: found.slot.id },
    });
    effects = { event: { code: 'WF_RETURNED', recipients: ['REQUESTER'] } };
  }, TX_OPTS);

  const view = await loadView(prisma, companyId, requestId);
  await afterCommit(view, effects);
  return view;
}

export async function cancel(companyId: number, requestId: number, actor: PlatformActor, reason?: string, opts: VerbOptions = {}): Promise<WorkflowRequestView> {
  await prisma.$transaction(async (tx) => {
    const req = await tx.workflowRequest.findFirst({ where: { id: requestId, companyId } });
    if (!req) throw new WorkflowError('WF-404', 'Request not found', 404);
    if (TERMINAL_STATUSES.has(req.currentStatus) || req.currentStatus === WF_STATUS.Submitted) {
      throw new WorkflowError('WF-STATE-409', `Request is ${req.currentStatus}; cannot cancel`, 409);
    }
    if (!isRequester(req, actor) && !opts.asAdmin) throw new WorkflowError('WF-FORBIDDEN-403', 'Only the requester or a workflow administrator may cancel', 403);
    const requestType = await loadRequestType(tx, companyId, req.requestTypeCode);
    const submitted = !!req.submittedAt;
    if (submitted && !requestType.allowCancelAfterSubmit && !opts.asAdmin) throw new WorkflowError('WF-CANCEL-403', 'Cancellation after submit is not permitted for this request type', 403);
    const r = submitted ? requireReason(reason, 'WF-REASON-400', 'Cancellation reason', 1) : (reason ?? '').trim() || null;

    await transition(tx, req, req.currentStatus, { currentStatus: WF_STATUS.Cancelled, decidedAt: new Date(), decisionRemark: r, dueAt: null });
    await writeAction(tx, req, { verb: 'Cancel', fromStatus: req.currentStatus, toStatus: WF_STATUS.Cancelled, levelNo: req.currentLevel || null, actor, remark: r, detail: { byAdmin: !!opts.asAdmin && !isRequester(req, actor) } });
  }, TX_OPTS);
  return loadView(prisma, companyId, requestId);
}

/**
 * Re-submit from Returned (§6.4, §7.6, §11.3): re-validate; re-evaluate the
 * matrix only if a condition value changed; a different matrix/version
 * discards every approval (marked "Superseded by re-evaluation") and
 * restarts at level 1; otherwise earlier levels are retained and the
 * returning level restarts.
 */
export async function resubmit(
  companyId: number,
  requestId: number,
  actor: PlatformActor,
  opts: VerbOptions & { patch?: { title?: string; payload?: unknown; amount?: number | string | null; requestSubType?: string | null } } = {},
): Promise<WorkflowRequestView> {
  const now = new Date();
  let effects: Parameters<typeof afterCommit>[1] = {};

  await prisma.$transaction(async (tx) => {
    let req = await tx.workflowRequest.findFirst({ where: { id: requestId, companyId } });
    if (!req) throw new WorkflowError('WF-404', 'Request not found', 404);
    if (req.currentStatus !== WF_STATUS.Returned) throw new WorkflowError('WF-STATE-409', `Request is ${req.currentStatus}; only Returned may be re-submitted`, 409);
    if (!isRequester(req, actor) && !opts.asAdmin) throw new WorkflowError('WF-FORBIDDEN-403', 'Only the requester may re-submit', 403);
    const requestType = await loadRequestType(tx, companyId, req.requestTypeCode);

    // Optional inline edits before re-validation.
    const patch = opts.patch ?? {};
    const data: Prisma.WorkflowRequestUpdateManyMutationInput = { currentStatus: WF_STATUS.Submitted };
    if (patch.title !== undefined) data.title = patch.title.slice(0, 200);
    if (patch.payload !== undefined) data.payloadJson = JSON.stringify(patch.payload);
    if (patch.amount !== undefined) data.amount = toDecimal(patch.amount);
    if (patch.requestSubType !== undefined) data.requestSubType = patch.requestSubType;
    await transition(tx, req, WF_STATUS.Returned, data);
    req = (await tx.workflowRequest.findFirst({ where: { id: requestId, companyId } }))!;

    const previous = parseJson<RequestContext>(req.contextJson);
    const context = await buildRequestContext(tx, companyId, req.subjectEmpId ?? req.requesterEmpId, req.amount, req.requestSubType);

    const handler = getWorkflowHandler(requestType.handlerKey);
    if (handler?.validate) {
      const result = await handler.validate(toRequestView({ ...req, contextJson: JSON.stringify(context) }));
      if (!result.ok) {
        // Back to Returned: still the requester's responsibility, edit rights intact.
        await tx.workflowRequest.update({ where: { id: req.id }, data: { currentStatus: WF_STATUS.Returned, validationErrorsJson: JSON.stringify(result.errors), contextJson: JSON.stringify(context) } });
        await writeAction(tx, req, { verb: 'Validate', fromStatus: WF_STATUS.Submitted, toStatus: WF_STATUS.Returned, actor: SYSTEM_ACTOR, detail: { errors: result.errors, onResubmit: true } });
        return;
      }
    }

    const conditionsChanged = conditionFingerprint(previous) !== conditionFingerprint(context);
    let matrixId = req.matrixId;
    let matrixVersionNo = req.matrixVersionNo;
    let reEvaluated = false;
    let restartLevel = Math.max(1, req.currentLevel);

    if (conditionsChanged || !matrixId) {
      const candidates = await loadMatrixCandidates(tx, companyId, req.requestTypeCode);
      const selection = selectMatrix(candidates, context, now);
      if (selection.matrix.id !== matrixId || selection.matrix.versionNo !== matrixVersionNo) {
        reEvaluated = true;
        matrixId = selection.matrix.id;
        matrixVersionNo = selection.matrix.versionNo;
        restartLevel = 1;
        await tx.workflowSlot.updateMany({
          where: { requestId: req.id, status: { in: [SLOT_STATUS.Pending, SLOT_STATUS.Approved, SLOT_STATUS.Returned] } },
          data: { status: SLOT_STATUS.Replaced, remark: 'Superseded by re-evaluation' },
        });
      }
    }
    if (!reEvaluated) {
      // Same matrix: keep earlier levels, restart the returning level.
      await tx.workflowSlot.updateMany({
        where: { requestId: req.id, levelNo: restartLevel, status: { in: [SLOT_STATUS.Pending, SLOT_STATUS.Approved, SLOT_STATUS.Returned] } },
        data: { status: SLOT_STATUS.Replaced, remark: 'Level restarted on re-submit' },
      });
    }

    const lines = await loadMatrixLines(tx, matrixId!);
    if (lines.length === 0) throw new WorkflowError('WF-MATRIX-EMPTY-422', 'Bound matrix has no lines', 422);
    await tx.workflowRequest.update({
      where: { id: req.id },
      data: { matrixId, matrixVersionNo, contextJson: JSON.stringify(context), validationErrorsJson: null, currentStatus: WF_STATUS.PendingApproval },
    });
    const bound = { ...req, matrixId, matrixVersionNo };
    await writeAction(tx, bound, {
      verb: 'Resubmit',
      fromStatus: WF_STATUS.Returned,
      toStatus: WF_STATUS.PendingApproval,
      levelNo: restartLevel,
      actor,
      detail: { conditionsChanged, matrixReEvaluated: reEvaluated, matrixId, matrixVersionNo, restartLevel },
    });

    const entry = await enterLevels(tx, bound, lines, restartLevel, actor, now);
    if (entry.status === 'approved') {
      await finishApproved(tx, bound, WF_STATUS.PendingApproval, SYSTEM_ACTOR, 'Remaining levels auto-satisfied at re-submit');
      effects = { onApproved: requestType.handlerKey, event: { code: 'WF_APPROVED', recipients: ['REQUESTER', 'SUBJECT_EMPLOYEE'] } };
    } else {
      effects = { event: { code: 'WF_PENDING_APPROVAL', recipients: ['CURRENT_APPROVERS'] } };
    }
  }, TX_OPTS);

  const view = await loadView(prisma, companyId, requestId);
  await afterCommit(view, effects);
  return view;
}

// ─── read ────────────────────────────────────────────────────────────────────

export async function getRequest(companyId: number, requestId: number, actor: PlatformActor, opts: VerbOptions = {}): Promise<WorkflowRequestView> {
  const view = await loadView(prisma, companyId, requestId);
  // A Draft is visible only to its requester (§6.3).
  if (view.currentStatus === WF_STATUS.Draft && !opts.asAdmin) {
    const mine = (actor.employeeId != null && actor.employeeId === view.requesterEmpId) || (actor.userId != null && actor.userId === view.requesterUserId);
    if (!mine) throw new WorkflowError('WF-404', 'Request not found', 404);
  }
  return view;
}

export type ListRequestsOptions = {
  status?: string;
  requestTypeCode?: string;
  moduleCode?: string;
  requesterEmpId?: number;
  subjectEmpId?: number;
  sourceEntityType?: string;
  sourceEntityId?: number;
  page?: number;
  limit?: number;
};

export async function listRequests(companyId: number, opts: ListRequestsOptions = {}): Promise<{ data: WorkflowRequestView[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(200, Math.max(1, opts.limit ?? 25));
  const where: Prisma.WorkflowRequestWhereInput = {
    companyId,
    ...(opts.status ? { currentStatus: opts.status } : {}),
    ...(opts.requestTypeCode ? { requestTypeCode: opts.requestTypeCode } : {}),
    ...(opts.moduleCode ? { moduleCode: opts.moduleCode } : {}),
    ...(opts.requesterEmpId ? { requesterEmpId: opts.requesterEmpId } : {}),
    ...(opts.subjectEmpId ? { subjectEmpId: opts.subjectEmpId } : {}),
    ...(opts.sourceEntityType ? { sourceEntityType: opts.sourceEntityType } : {}),
    ...(opts.sourceEntityId ? { sourceEntityId: opts.sourceEntityId } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.workflowRequest.count({ where }),
    prisma.workflowRequest.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
  ]);
  return { data: rows.map((r) => toRequestView(r)), total };
}

/**
 * Approver inbox (§10.1 "Pending on me" + "Delegated to me"): requests
 * pending at a level where the actor — or someone who delegated to the
 * actor — holds a Pending slot. `mine` lists requests the actor raised or
 * is the subject of, all statuses.
 */
export async function inbox(
  companyId: number,
  actor: PlatformActor,
  opts: { status?: string; requestTypeCode?: string; page?: number; limit?: number; mine?: boolean } = {},
): Promise<{ data: WorkflowRequestView[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(200, Math.max(1, opts.limit ?? 25));

  if (opts.mine) {
    const or: Prisma.WorkflowRequestWhereInput[] = [];
    if (actor.employeeId != null) or.push({ requesterEmpId: actor.employeeId }, { subjectEmpId: actor.employeeId }, { onBehalfOfEmpId: actor.employeeId });
    if (actor.userId != null) or.push({ requesterUserId: actor.userId });
    if (or.length === 0) return { data: [], total: 0 };
    const where: Prisma.WorkflowRequestWhereInput = {
      companyId,
      OR: or,
      ...(opts.status ? { currentStatus: opts.status } : {}),
      ...(opts.requestTypeCode ? { requestTypeCode: opts.requestTypeCode } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.workflowRequest.count({ where }),
      prisma.workflowRequest.findMany({ where, orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * limit, take: limit }),
    ]);
    return { data: rows.map((r) => toRequestView(r)), total };
  }

  const today = istToday();
  const delegations = actor.employeeId != null ? await activeDelegationsFor(prisma, companyId, actor.employeeId, today) : [];
  const delegatorIds = delegations.map((d) => d.delegatorEmpId);

  const slotOr: Prisma.WorkflowSlotWhereInput[] = [];
  if (actor.employeeId != null) slotOr.push({ resolvedEmpId: actor.employeeId });
  if (actor.userId != null) slotOr.push({ resolvedUserId: actor.userId });
  if (delegatorIds.length > 0) slotOr.push({ resolvedEmpId: { in: delegatorIds } });
  if (slotOr.length === 0) return { data: [], total: 0 };

  const slots = await prisma.workflowSlot.findMany({
    where: { status: SLOT_STATUS.Pending, OR: slotOr },
    select: { requestId: true, levelNo: true, resolvedEmpId: true, resolvedUserId: true },
  });
  if (slots.length === 0) return { data: [], total: 0 };

  const requestIds = [...new Set(slots.map((s) => s.requestId))];
  const requests = await prisma.workflowRequest.findMany({
    where: {
      id: { in: requestIds },
      companyId,
      currentStatus: opts.status ?? WF_STATUS.PendingApproval,
      ...(opts.requestTypeCode ? { requestTypeCode: opts.requestTypeCode } : {}),
    },
  });
  const typeCodes = [...new Set(requests.map((r) => r.requestTypeCode))];
  const types = typeCodes.length ? await prisma.workflowRequestType.findMany({ where: { companyId, code: { in: typeCodes } } }) : [];
  const typeByCode = new Map(types.map((t) => [t.code, t]));

  const visible = requests.filter((r) => {
    const atLevel = slots.filter((s) => s.requestId === r.id && s.levelNo === r.currentLevel);
    if (atLevel.length === 0) return false;
    const own = atLevel.some((s) => (actor.employeeId != null && s.resolvedEmpId === actor.employeeId) || (actor.userId != null && s.resolvedUserId === actor.userId));
    if (own) return true;
    // Delegated: apply §8.3 rules 1 and 6 and the type's allowDelegation.
    if (actor.employeeId == null || actor.employeeId === r.requesterEmpId) return false;
    if (typeByCode.get(r.requestTypeCode)?.allowDelegation === false) return false;
    return delegations.some((d) => scopeMatches(d, r) && ceilingAllows(d, r) && atLevel.some((s) => s.resolvedEmpId === d.delegatorEmpId));
  });
  visible.sort((a, b) => (b.dueAt?.getTime() ?? 0) - (a.dueAt?.getTime() ?? 0) || b.id - a.id);
  const pageRows = visible.slice((page - 1) * limit, page * limit);
  return { data: pageRows.map((r) => toRequestView(r)), total: visible.length };
}

// ─── escalation sweep (§9) ───────────────────────────────────────────────────

async function exhaustRequest(tx: Tx, req: RequestRow, requestType: RequestTypeRow, now: Date): Promise<{ autoApproved: boolean; handlerKey: string | null }> {
  await tx.workflowRequest.update({ where: { id: req.id }, data: { escalationExhausted: true } });
  await writeAction(tx, req, {
    verb: 'Escalate',
    fromStatus: WF_STATUS.PendingApproval,
    toStatus: WF_STATUS.PendingApproval,
    levelNo: req.currentLevel,
    actor: SYSTEM_ACTOR,
    remark: 'Escalation hops exhausted — routed to the HR Workflow Administrator exception queue',
    detail: { exhausted: true, slaBreachCount: req.slaBreachCount },
  });
  if (!requestType.autoApproveOnExhaustion) return { autoApproved: false, handlerKey: requestType.handlerKey };

  // §9.5: low-risk types only. Approve every pending slot as the service account.
  await tx.workflowSlot.updateMany({
    where: { requestId: req.id, levelNo: req.currentLevel, status: SLOT_STATUS.Pending },
    data: { status: SLOT_STATUS.Approved, actedAt: now, remark: 'AUTO_APPROVED_ON_SLA_EXHAUSTION' },
  });
  await writeAction(tx, req, { verb: 'Approve', fromStatus: WF_STATUS.PendingApproval, toStatus: WF_STATUS.PendingApproval, levelNo: req.currentLevel, actor: SYSTEM_ACTOR, remark: 'AUTO_APPROVED_ON_SLA_EXHAUSTION' });
  const lines = await loadMatrixLines(tx, req.matrixId!);
  const entry = await enterLevels(tx, req, lines, req.currentLevel + 1, SYSTEM_ACTOR, now);
  if (entry.status === 'approved') {
    await finishApproved(tx, req, WF_STATUS.PendingApproval, SYSTEM_ACTOR, 'AUTO_APPROVED_ON_SLA_EXHAUSTION', { autoApproved: true });
    return { autoApproved: true, handlerKey: requestType.handlerKey };
  }
  return { autoApproved: false, handlerKey: requestType.handlerKey };
}

type SweepOutcome = { kind: 'escalated' | 'exhausted' | 'none'; autoApproved?: boolean; handlerKey?: string | null };

async function escalateOne(tx: Tx, reqId: number, companyId: number, now: Date): Promise<SweepOutcome> {
  const req = await tx.workflowRequest.findFirst({ where: { id: reqId, companyId } });
  if (!req || req.currentStatus !== WF_STATUS.PendingApproval || req.escalationExhausted || !req.dueAt || req.dueAt.getTime() > now.getTime() || !req.matrixId) {
    return { kind: 'none' };
  }
  const requestType = await loadRequestType(tx, companyId, req.requestTypeCode);
  const lines = (await loadMatrixLines(tx, req.matrixId)).filter((l) => l.levelNo === req.currentLevel);
  if (lines.length === 0) return { kind: 'none' };
  const maxHops = lines.reduce((m, l) => Math.max(m, l.maxEscalationHops), 0);
  const slaDays = (lines.reduce((m, l) => Math.max(m, Number(l.escalationDays.toString())), 0) || 2) * (req.priority === 'URGENT' ? 0.5 : 1);

  const pending = await tx.workflowSlot.findMany({ where: { requestId: req.id, levelNo: req.currentLevel, status: SLOT_STATUS.Pending }, orderBy: [{ sequence: 'asc' }, { id: 'asc' }] });
  if (pending.length === 0) return { kind: 'none' };
  const lineFor = (slot: SlotRow) => lines.find((l) => l.sequence === slot.sequence) ?? lines[0];
  if (lines.every((l) => l.escalationTargetType === 'NONE')) return { kind: 'none' }; // stays pending, ageing report only

  if (req.slaBreachCount >= maxHops) {
    const r = await exhaustRequest(tx, req, requestType, now);
    return { kind: 'exhausted', ...r };
  }

  const elapsed = req.levelEnteredAt ? await elapsedBusinessDays(companyId, pending[0].resolvedEmpId, req.levelEnteredAt, now) : null;
  const holderKeys = new Set(pending.map((s) => (s.resolvedEmpId != null ? `e${s.resolvedEmpId}` : `u${s.resolvedUserId}`)));

  let hop = req.slaBreachCount + 1;
  while (hop <= maxHops) {
    // Whom to escalate from: hop 1 → the original approvers; hop n → the hop n-1 targets (falling back to the latest hop present).
    const maxHopPresent = pending.reduce((m, s) => Math.max(m, s.escalationHop), 0);
    const from = pending.filter((s) => s.escalationHop === (hop === 1 ? 0 : Math.min(hop - 1, maxHopPresent)));
    const late = from.length ? from : pending;

    const created: Array<{ from: SlotRow; to: ResolvedApprover; mode: string }> = [];
    const vacant: SlotRow[] = [];
    for (const slot of late) {
      const line = lineFor(slot);
      let targets: ResolvedApprover[];
      if (hop === 1) {
        if (line.escalationTargetType === 'NONE') continue;
        targets = await resolveApprovers(tx, companyId, line.escalationTargetType, line.escalationTargetRef ?? 'APPROVER_MANAGER_L1', {
          requesterEmpId: req.requesterEmpId,
          subjectEmpId: req.subjectEmpId,
          approverEmpId: slot.resolvedEmpId,
        });
      } else {
        targets = await resolveApprovers(tx, companyId, 'POSITION', 'APPROVER_MANAGER_L1', { requesterEmpId: req.requesterEmpId, subjectEmpId: req.subjectEmpId, approverEmpId: slot.resolvedEmpId });
      }
      // §9.4: the requester is never a target; an existing holder is not added twice.
      targets = targets.filter((t) => t.empId !== req.requesterEmpId && !holderKeys.has(t.empId != null ? `e${t.empId}` : `u${t.userId}`));
      if (targets.length === 0) {
        vacant.push(slot);
        continue;
      }
      for (const t of targets) {
        created.push({ from: slot, to: t, mode: line.escalationMode });
        holderKeys.add(t.empId != null ? `e${t.empId}` : `u${t.userId}`);
      }
    }

    if (created.length === 0) {
      // Every target vacant (or the requester): log and advance the hop immediately.
      for (const slot of vacant) {
        await tx.workflowEscalation.create({
          data: { companyId, requestId: req.id, levelNo: req.currentLevel, hopNo: hop, fromApproverEmpId: slot.resolvedEmpId, toApproverEmpId: null, mode: lineFor(slot).escalationMode, dueAtBefore: req.dueAt, dueAtAfter: req.dueAt, elapsedBusinessDays: elapsed, triggerType: 'AUTOMATIC', reasonText: 'TARGET_VACANT' },
        });
      }
      await writeAction(tx, req, { verb: 'Escalate', fromStatus: WF_STATUS.PendingApproval, toStatus: WF_STATUS.PendingApproval, levelNo: req.currentLevel, actor: SYSTEM_ACTOR, remark: 'TARGET_VACANT', detail: { hop, vacant: true } });
      await tx.workflowRequest.update({ where: { id: req.id }, data: { slaBreachCount: hop } });
      req.slaBreachCount = hop;
      hop++;
      continue;
    }

    // Materialise the escalation slots.
    const newHolders: number[] = [];
    for (const c of created) {
      const line = lineFor(c.from);
      if (c.mode === 'REPLACE' && c.from.status === SLOT_STATUS.Pending) {
        await tx.workflowSlot.updateMany({ where: { id: c.from.id, status: SLOT_STATUS.Pending }, data: { status: SLOT_STATUS.Replaced, remark: 'SLA breach substitution' } });
        c.from.status = SLOT_STATUS.Replaced;
      }
      await tx.workflowSlot.create({
        data: {
          requestId: req.id,
          levelNo: req.currentLevel,
          sequence: c.from.sequence,
          parallelGroup: c.from.parallelGroup,
          approverType: hop === 1 ? line.escalationTargetType : 'POSITION',
          approverRef: hop === 1 ? (line.escalationTargetRef ?? 'APPROVER_MANAGER_L1') : 'APPROVER_MANAGER_L1',
          resolvedEmpId: c.to.empId,
          resolvedUserId: c.to.userId,
          isMandatory: c.from.isMandatory,
          quorumRule: c.from.quorumRule,
          quorumN: c.from.quorumN,
          status: SLOT_STATUS.Pending,
          escalationHop: hop,
          remark: `Escalation hop ${hop} (${c.mode}) from slot ${c.from.id}`,
        },
      });
      if (c.to.empId != null) newHolders.push(c.to.empId);
    }

    // New SLA on the escalation target's calendar (§9.3).
    let dueAtAfter: Date | null = null;
    for (const empId of newHolders.length ? [...new Set(newHolders)] : [null]) {
      const d = await addBusinessDays(companyId, empId, now, slaDays);
      if (!dueAtAfter || d.getTime() > dueAtAfter.getTime()) dueAtAfter = d;
    }
    for (const c of created) {
      await tx.workflowEscalation.create({
        data: { companyId, requestId: req.id, levelNo: req.currentLevel, hopNo: hop, fromApproverEmpId: c.from.resolvedEmpId, toApproverEmpId: c.to.empId, mode: c.mode, dueAtBefore: req.dueAt, dueAtAfter, elapsedBusinessDays: elapsed, triggerType: 'AUTOMATIC', reasonText: null },
      });
    }
    await tx.workflowRequest.update({ where: { id: req.id }, data: { slaBreachCount: hop, dueAt: dueAtAfter } });
    await writeAction(tx, req, {
      verb: 'Escalate',
      fromStatus: WF_STATUS.PendingApproval,
      toStatus: WF_STATUS.PendingApproval,
      levelNo: req.currentLevel,
      actor: SYSTEM_ACTOR,
      remark: `SLA breached — escalation hop ${hop}`,
      detail: { hop, targets: created.map((c) => ({ from: c.from.resolvedEmpId, to: c.to.empId, mode: c.mode })), dueAtBefore: req.dueAt, dueAtAfter },
    });
    return { kind: 'escalated' };
  }

  // Ran out of hops while every target was vacant.
  const r = await exhaustRequest(tx, { ...req, slaBreachCount: maxHops }, requestType, now);
  return { kind: 'exhausted', ...r };
}

/** Escalate every Pending request past its dueAt (§9.1–9.5); also expires delegations past toDate (§8.3 rule 9). */
export async function runEscalationSweep(companyId?: number): Promise<{ escalated: number; exhausted: number }> {
  const now = new Date();
  const due = await prisma.workflowRequest.findMany({
    where: { ...(companyId ? { companyId } : {}), currentStatus: WF_STATUS.PendingApproval, escalationExhausted: false, dueAt: { lt: now } },
    select: { id: true, companyId: true },
    orderBy: { dueAt: 'asc' },
    take: 500,
  });

  let escalated = 0;
  let exhausted = 0;
  for (const r of due) {
    try {
      const outcome = await prisma.$transaction((tx) => escalateOne(tx, r.id, r.companyId, now), TX_OPTS);
      if (outcome.kind === 'none') continue;
      const view = await loadView(prisma, r.companyId, r.id);
      if (outcome.kind === 'escalated') {
        escalated++;
        await emitPlatformEvent(r.companyId, 'WF_ESCALATED', eventCtx(view, { recipients: ['CURRENT_APPROVERS', 'REQUESTER'] }));
      } else {
        exhausted++;
        await emitPlatformEvent(r.companyId, 'WF_ESCALATION_EXHAUSTED', eventCtx(view, { recipients: ['ROLE:hr-admin', 'REQUESTER'], priority: 'URGENT' }));
        if (outcome.autoApproved) await afterCommit(view, { onApproved: outcome.handlerKey ?? null, event: { code: 'WF_APPROVED', recipients: ['REQUESTER', 'SUBJECT_EMPLOYEE', 'ROLE:hr-admin'] } });
      }
    } catch (err) {
      console.error(`[platform/workflow] escalation of request ${r.id} failed:`, err);
    }
  }

  // Delegation expiry — cheap, and keeps the status column truthful.
  await prisma.workflowDelegation.updateMany({
    where: { ...(companyId ? { companyId } : {}), status: 'Active', toDate: { lt: istToday(now) } },
    data: { status: 'Expired' },
  });

  return { escalated, exhausted };
}

export { WorkflowError, WF_STATUS, SLOT_STATUS } from './types';
export type { CreateDraftInput, WorkflowRequestView, WorkflowSlotView, WorkflowActionView, RequestContext } from './types';
