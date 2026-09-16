/**
 * Workflow engine end-to-end against the real dev DB (company KUNAERO).
 *
 * Builds its own fixture chain inside KUNAERO so the run does not depend on
 * which seeded employees happen to have managers:
 *   GM (grand manager) ← MGR (manager) ← REQ (requester)
 *   PEER               (reports to GM; the manager's delegate)
 *   HR                 (employee linked to a user holding role hr-admin)
 * Uses the demo request type LEAVE_APPLICATION and its fallback matrix
 * LEAVE-DEFAULT (scripts/seed-platform-workflow-demo.mjs) — L1 REQUESTER_MANAGER_L1,
 * L2 ROLE hr-admin. Everything created here is removed in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { TEST_CODE_PREFIX, makeRequest } from './fixtures';
import {
  createDraft,
  submit,
  approve,
  reject,
  returnForCorrection,
  cancel,
  resubmit,
  inbox,
  getRequest,
  runEscalationSweep,
  WorkflowError,
} from '@/lib/platform/workflow/engine';
import type { PlatformActor } from '@/lib/platform/contracts';
import { readSnapshot, supersedeSnapshot, takeSnapshot, verifySnapshot } from '@/lib/platform/snapshot/service';

const COMPANY_CODE = 'KUNAERO';
const TYPE = 'LEAVE_APPLICATION';

let companyId: number;
let hrRoleId: number;
let viewerRoleId: number;
let masters: { departmentId: number; designationId: number; employeeTypeId: number };

type Fx = { id: number; userId: number | null; code: string };
let GM: Fx;
let MGR: Fx;
let REQ: Fx;
let PEER: Fx;
let HR: Fx;

const createdEmployeeIds: number[] = [];
const createdUserIds: number[] = [];
const createdRequestIds: number[] = [];
const createdDelegationIds: number[] = [];
const createdSnapshotIds: number[] = [];

const suffix = () => Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);

async function mkUser(roleId: number): Promise<number> {
  const u = await prisma.user.create({
    data: { email: `wf-test-${suffix()}@test.local`, passwordHash: 'x', companyId, roleId, isActive: true },
    select: { id: true },
  });
  createdUserIds.push(u.id);
  return u.id;
}

async function mkEmployee(name: string, reportingManagerId: number | null, userId: number | null): Promise<Fx> {
  const code = `${TEST_CODE_PREFIX}${suffix()}`.slice(0, 20);
  const emp = await prisma.employee.create({
    data: {
      companyId,
      employeeCode: `WFT-${suffix()}`.slice(0, 20),
      oldEmployeeCode: code,
      firstName: name,
      lastName: 'WorkflowTest',
      status: 'active',
      reportingManagerId,
      userId,
      jobInfos: {
        create: {
          departmentId: masters.departmentId,
          designationId: masters.designationId,
          employeeTypeId: masters.employeeTypeId,
          joinDate: new Date(Date.UTC(2025, 0, 1)),
          effectiveFrom: new Date(Date.UTC(2025, 0, 1)),
        },
      },
    },
    select: { id: true, userId: true, employeeCode: true },
  });
  createdEmployeeIds.push(emp.id);
  return { id: emp.id, userId: emp.userId, code: emp.employeeCode };
}

const actorOf = (e: Fx): PlatformActor => ({ userId: e.userId, employeeId: e.id, source: 'user' });

async function draft(requester: Fx, extra: Partial<Parameters<typeof createDraft>[0]> = {}) {
  const view = await createDraft({
    companyId,
    requestTypeCode: TYPE,
    sourceEntityType: 'LeaveApplication',
    sourceEntityId: 0,
    title: 'EL 2 days',
    requesterEmpId: requester.id,
    payload: { leaveType: 'EL', from: '2026-10-05', to: '2026-10-06' },
    actor: actorOf(requester),
    ...extra,
  });
  createdRequestIds.push(view.id);
  return view;
}

beforeAll(async () => {
  const company = await prisma.company.findFirst({ where: { code: COMPANY_CODE, deletedAt: null }, select: { id: true } });
  if (!company) throw new Error('KUNAERO company missing');
  companyId = company.id;

  const roles = await prisma.role.findMany({ where: { companyId, code: { in: ['hr-admin', 'hr-viewer', 'company-admin'] } } });
  hrRoleId = roles.find((r) => r.code === 'hr-admin')!.id;
  viewerRoleId = roles.find((r) => r.code === 'hr-viewer')!.id;

  const rt = await prisma.workflowRequestType.findFirst({ where: { companyId, code: TYPE } });
  const mx = await prisma.workflowMatrix.findFirst({ where: { companyId, requestTypeCode: TYPE, isFallback: true, status: 'Active' } });
  if (!rt || !mx) throw new Error('Run scripts/seed-platform-workflow-demo.mjs first');

  const [department, designation, employeeType] = await Promise.all([
    prisma.department.findFirst({ where: { deletedAt: null } }),
    prisma.designation.findFirst({ where: { deletedAt: null } }),
    prisma.employeeType.findFirst({ where: { deletedAt: null } }),
  ]);
  masters = { departmentId: department!.id, designationId: designation!.id, employeeTypeId: employeeType!.id };

  GM = await mkEmployee('Grand', null, await mkUser(viewerRoleId));
  MGR = await mkEmployee('Manager', GM.id, await mkUser(viewerRoleId));
  REQ = await mkEmployee('Requester', MGR.id, await mkUser(viewerRoleId));
  PEER = await mkEmployee('Peer', GM.id, await mkUser(viewerRoleId));
  HR = await mkEmployee('HrAdmin', GM.id, await mkUser(hrRoleId));
});

afterAll(async () => {
  const reqIds = createdRequestIds;
  if (reqIds.length) {
    await prisma.workflowEscalation.deleteMany({ where: { requestId: { in: reqIds } } });
    await prisma.workflowAction.deleteMany({ where: { requestId: { in: reqIds } } });
    await prisma.workflowSlot.deleteMany({ where: { requestId: { in: reqIds } } });
    await prisma.auditLog.deleteMany({ where: { entityType: 'WorkflowRequest', entityId: { in: reqIds } } });
    await prisma.workflowRequest.deleteMany({ where: { id: { in: reqIds } } });
  }
  if (createdDelegationIds.length) {
    await prisma.auditLog.deleteMany({ where: { entityType: 'WorkflowDelegation', entityId: { in: createdDelegationIds } } });
    await prisma.workflowDelegation.deleteMany({ where: { id: { in: createdDelegationIds } } });
  }
  if (createdSnapshotIds.length) {
    await prisma.auditLog.deleteMany({ where: { entityType: 'ConfigSnapshot', entityId: { in: createdSnapshotIds } } });
    await prisma.configSnapshot.deleteMany({ where: { id: { in: createdSnapshotIds } } });
  }
  for (const id of createdEmployeeIds) {
    const e = await prisma.employee.findUnique({ where: { id }, select: { oldEmployeeCode: true } });
    if (!e?.oldEmployeeCode?.startsWith(TEST_CODE_PREFIX)) throw new Error(`refusing to delete non-fixture employee ${id}`);
  }
  // Break the manager links first (self-referential FK, NoAction).
  await prisma.employee.updateMany({ where: { id: { in: createdEmployeeIds } }, data: { reportingManagerId: null, secondReportingManagerId: null } });
  await prisma.jobInfo.deleteMany({ where: { employeeId: { in: createdEmployeeIds } } });
  await prisma.employee.deleteMany({ where: { id: { in: createdEmployeeIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe('platform workflow — happy path', () => {
  it('draft → submit → manager approves → hr-admin approves → Approved, with actions and audit rows', async () => {
    const d = await draft(REQ);
    expect(d.currentStatus).toBe('Draft');
    expect(d.currentLevel).toBe(0);
    expect(d.requestNo).toMatch(/^LEAVE_APPLICATION\/\d{4}\/\d{6}$/);
    expect(d.context?.departmentCode).toBeTruthy();

    const s = await submit(companyId, d.id, actorOf(REQ));
    expect(s.currentStatus).toBe('Pending Approval');
    expect(s.currentLevel).toBe(1);
    expect(s.matrixId).not.toBeNull();
    expect(s.submittedAt).not.toBeNull();
    expect(s.dueAt!.getTime()).toBeGreaterThan(Date.now());
    const l1 = s.slots.filter((x) => x.levelNo === 1);
    expect(l1).toHaveLength(1);
    expect(l1[0].approverRef).toBe('REQUESTER_MANAGER_L1');
    expect(l1[0].resolvedEmpId).toBe(MGR.id);
    expect(l1[0].status).toBe('Pending');

    const a1 = await approve(companyId, d.id, actorOf(MGR), 'ok');
    expect(a1.currentStatus).toBe('Pending Approval');
    expect(a1.currentLevel).toBe(2);
    const l2 = a1.slots.filter((x) => x.levelNo === 2 && x.status === 'Pending');
    expect(l2.length).toBeGreaterThanOrEqual(1);
    expect(l2.some((x) => x.resolvedEmpId === HR.id)).toBe(true);
    expect(a1.slots.find((x) => x.levelNo === 1)!.status).toBe('Approved');

    const a2 = await approve(companyId, d.id, actorOf(HR), 'approved by HR');
    expect(a2.currentStatus).toBe('Approved');
    expect(a2.decidedAt).not.toBeNull();
    expect(a2.actions.filter((x) => x.verb === 'Approve')).toHaveLength(2);
    expect(a2.actions.map((x) => x.verb)).toEqual(expect.arrayContaining(['Create', 'Submit', 'Approve', 'Complete']));

    const auditRows = await prisma.auditLog.findMany({ where: { companyId, entityType: 'WorkflowRequest', entityId: d.id } });
    expect(auditRows.filter((r) => r.action === 'APPROVE')).toHaveLength(2);
    expect(auditRows.some((r) => r.action === 'SUBMIT')).toBe(true);
    expect(auditRows.every((r) => r.entityRef === d.requestNo)).toBe(true);
  });

  it('inbox shows the request to the manager (pending on me) and to the requester (?mine=1)', async () => {
    const d = await draft(REQ);
    await submit(companyId, d.id, actorOf(REQ));
    const mgrInbox = await inbox(companyId, actorOf(MGR));
    expect(mgrInbox.data.some((r) => r.id === d.id)).toBe(true);
    const peerInbox = await inbox(companyId, actorOf(PEER));
    expect(peerInbox.data.some((r) => r.id === d.id)).toBe(false);
    const mine = await inbox(companyId, actorOf(REQ), { mine: true });
    expect(mine.data.some((r) => r.id === d.id)).toBe(true);
  });
});

describe('platform workflow — guards', () => {
  it('reject with a short reason → 400; by a non-holder → 403; long reason → Rejected (terminal)', async () => {
    const d = await draft(REQ);
    await submit(companyId, d.id, actorOf(REQ));

    await expect(reject(companyId, d.id, actorOf(MGR), 'too short')).rejects.toMatchObject({ status: 400, code: 'WF-REASON-400' });
    await expect(reject(companyId, d.id, actorOf(PEER), 'a perfectly long rejection reason')).rejects.toMatchObject({ status: 403 });

    const r = await reject(companyId, d.id, actorOf(MGR), 'Insufficient leave balance for these dates');
    expect(r.currentStatus).toBe('Rejected');
    expect(r.decisionRemark).toBe('Insufficient leave balance for these dates');
    expect(r.slots.find((s) => s.levelNo === 1)!.status).toBe('Rejected');
    await expect(approve(companyId, d.id, actorOf(MGR))).rejects.toMatchObject({ status: 409 });
  });

  it('approve by someone who holds no slot → 403 WorkflowError; submit twice → 409', async () => {
    const d = await draft(REQ);
    await submit(companyId, d.id, actorOf(REQ));
    let err: unknown;
    try {
      await approve(companyId, d.id, actorOf(PEER));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(WorkflowError);
    expect((err as WorkflowError).status).toBe(403);
    await expect(submit(companyId, d.id, actorOf(REQ))).rejects.toMatchObject({ code: 'WF-STATE-409' });
    // The requester never approves their own request either.
    await expect(approve(companyId, d.id, actorOf(REQ))).rejects.toMatchObject({ status: 403 });
  });

  it('cancel: requester may cancel a draft without a reason, but needs one once submitted; a Draft is invisible to others', async () => {
    const d1 = await draft(REQ);
    await expect(getRequest(companyId, d1.id, actorOf(PEER))).rejects.toMatchObject({ status: 404 });
    const c1 = await cancel(companyId, d1.id, actorOf(REQ));
    expect(c1.currentStatus).toBe('Cancelled');

    const d2 = await draft(REQ);
    await submit(companyId, d2.id, actorOf(REQ));
    await expect(cancel(companyId, d2.id, actorOf(REQ))).rejects.toMatchObject({ code: 'WF-REASON-400' });
    await expect(cancel(companyId, d2.id, actorOf(PEER), 'not mine')).rejects.toMatchObject({ status: 403 });
    const c2 = await cancel(companyId, d2.id, actorOf(REQ), 'Plans changed');
    expect(c2.currentStatus).toBe('Cancelled');
  });

  it('return for correction pauses the SLA; re-submit restarts the level with fresh slots', async () => {
    const d = await draft(REQ);
    await submit(companyId, d.id, actorOf(REQ));
    const ret = await returnForCorrection(companyId, d.id, actorOf(MGR), 'Please attach the medical certificate');
    expect(ret.currentStatus).toBe('Returned');
    expect(ret.dueAt).toBeNull();
    expect(ret.slots.find((s) => s.levelNo === 1)!.status).toBe('Returned');

    const rs = await resubmit(companyId, d.id, actorOf(REQ), { patch: { payload: { leaveType: 'SL', certificate: 'x.pdf' } } });
    expect(rs.currentStatus).toBe('Pending Approval');
    expect(rs.currentLevel).toBe(1);
    expect(rs.dueAt).not.toBeNull();
    const l1 = rs.slots.filter((s) => s.levelNo === 1);
    expect(l1.map((s) => s.status).sort()).toEqual(['Pending', 'Replaced']);
    expect(l1.find((s) => s.status === 'Pending')!.resolvedEmpId).toBe(MGR.id);
    const resubmitAction = rs.actions.find((a) => a.verb === 'Resubmit');
    expect(resubmitAction).toBeTruthy();
    expect((resubmitAction!.detail as { matrixReEvaluated: boolean }).matrixReEvaluated).toBe(false);
  });
});

describe('platform workflow — delegation (§8)', () => {
  it('manager delegates to a peer for today; peer approves; slot records onBehalfOfEmpId and delegationId', async () => {
    const today = new Date();
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const del = await prisma.workflowDelegation.create({
      data: {
        companyId,
        delegatorEmpId: MGR.id,
        delegateEmpId: PEER.id,
        scopeType: 'ALL',
        fromDate: new Date(day.getTime() - 86400000),
        toDate: new Date(day.getTime() + 2 * 86400000),
        reasonCode: 'LEAVE',
        status: 'Active',
      },
    });
    createdDelegationIds.push(del.id);

    const d = await draft(REQ);
    await submit(companyId, d.id, actorOf(REQ));
    const peerInbox = await inbox(companyId, actorOf(PEER));
    expect(peerInbox.data.some((r) => r.id === d.id)).toBe(true);

    const a = await approve(companyId, d.id, actorOf(PEER), 'approved on behalf of manager');
    expect(a.currentLevel).toBe(2);
    const slot = a.slots.find((s) => s.levelNo === 1 && s.status === 'Approved')!;
    expect(slot.resolvedEmpId).toBe(MGR.id);
    expect(slot.actedByEmpId).toBe(PEER.id);
    expect(slot.onBehalfOfEmpId).toBe(MGR.id);
    expect(slot.delegationId).toBe(del.id);
    const action = a.actions.find((x) => x.verb === 'Approve')!;
    expect(action.onBehalfOfEmpId).toBe(MGR.id);
    expect(action.delegationId).toBe(del.id);
    const auditRow = await prisma.auditLog.findFirst({ where: { entityType: 'WorkflowRequest', entityId: d.id, action: 'APPROVE' } });
    expect(auditRow!.onBehalfOfEmpId).toBe(MGR.id);
    expect(auditRow!.actorEmpId).toBe(PEER.id);

    // Rule 6: an amount above the ceiling is not offered to the delegate.
    await prisma.workflowDelegation.update({ where: { id: del.id }, data: { amountCeiling: new Prisma.Decimal('1000') } });
    const big = await draft(REQ, { amount: '5000' });
    await submit(companyId, big.id, actorOf(REQ));
    await expect(approve(companyId, big.id, actorOf(PEER))).rejects.toMatchObject({ status: 403 });
    await prisma.workflowDelegation.update({ where: { id: del.id }, data: { status: 'Revoked', revokedAt: new Date() } });
  });

  it('POST /delegations: direct report ≤ 15 days → Active; a peer → Pending; self → 400; revoke works', async () => {
    const { POST } = await import('@/app/api/platform/workflow/delegations/route');
    const { POST: REVOKE } = await import('@/app/api/platform/workflow/delegations/[id]/revoke/route');
    const auth = { roleId: viewerRoleId, userId: MGR.userId! };
    const withCompany = (req: ReturnType<typeof makeRequest>) => {
      req.headers.set('x-company-id', String(companyId));
      return req;
    };
    const body = (delegateEmpId: number, days: number, month = '11') => ({
      delegateEmpId,
      fromDate: `2026-${month}-02`,
      toDate: `2026-${month}-${String(2 + days - 1).padStart(2, '0')}`,
      reasonCode: 'TRAVEL',
    });

    const r1 = await POST(withCompany(makeRequest('http://localhost/api/platform/workflow/delegations', { method: 'POST', auth, body: body(REQ.id, 5) })));
    expect(r1.status).toBe(201);
    const d1 = await r1.json();
    createdDelegationIds.push(d1.id);
    expect(d1.status).toBe('Active');

    // A different (non-overlapping) window, to a peer → needs approval.
    const r2 = await POST(withCompany(makeRequest('http://localhost/api/platform/workflow/delegations', { method: 'POST', auth, body: body(PEER.id, 5, '12') })));
    expect(r2.status).toBe(201);
    const d2 = await r2.json();
    createdDelegationIds.push(d2.id);
    expect(d2.status).toBe('Pending');

    const r3 = await POST(withCompany(makeRequest('http://localhost/api/platform/workflow/delegations', { method: 'POST', auth, body: body(MGR.id, 5) })));
    expect(r3.status).toBe(400);

    // Rule 4: overlapping ALL-scope delegation from the same delegator → 409.
    const r4 = await POST(withCompany(makeRequest('http://localhost/api/platform/workflow/delegations', { method: 'POST', auth, body: body(GM.id, 3) })));
    expect(r4.status).toBe(409);

    const rv = await REVOKE(
      withCompany(makeRequest(`http://localhost/api/platform/workflow/delegations/${d1.id}/revoke`, { method: 'POST', auth, body: { reason: 'back early' } })),
      { params: Promise.resolve({ id: String(d1.id) }) },
    );
    expect(rv.status).toBe(200);
    expect((await rv.json()).status).toBe('Revoked');
  });
});

describe('platform workflow — escalation (§9)', () => {
  it('a request past dueAt is escalated: WorkflowEscalation row, ADD slot for the manager’s manager, slaBreachCount 1, new dueAt', async () => {
    const d = await draft(REQ);
    await submit(companyId, d.id, actorOf(REQ));
    const past = new Date(Date.now() - 60 * 60 * 1000);
    await prisma.workflowRequest.update({ where: { id: d.id }, data: { dueAt: past } });

    const result = await runEscalationSweep(companyId);
    expect(result.escalated).toBeGreaterThanOrEqual(1);

    const esc = await prisma.workflowEscalation.findMany({ where: { requestId: d.id } });
    expect(esc).toHaveLength(1);
    expect(esc[0].hopNo).toBe(1);
    expect(esc[0].mode).toBe('ADD');
    expect(esc[0].fromApproverEmpId).toBe(MGR.id);
    expect(esc[0].toApproverEmpId).toBe(GM.id);
    expect(esc[0].dueAtBefore!.getTime()).toBe(past.getTime());
    expect(esc[0].dueAtAfter!.getTime()).toBeGreaterThan(Date.now());

    const v = await getRequest(companyId, d.id, actorOf(REQ));
    expect(v.currentStatus).toBe('Pending Approval');
    expect(v.currentLevel).toBe(1);
    expect(v.slaBreachCount).toBe(1);
    expect(v.dueAt!.getTime()).toBeGreaterThan(Date.now());
    const l1 = v.slots.filter((s) => s.levelNo === 1);
    expect(l1.map((s) => [s.resolvedEmpId, s.status, s.escalationHop]).sort()).toEqual([[GM.id, 'Pending', 1], [MGR.id, 'Pending', 0]].sort());
    expect(v.actions.some((a) => a.verb === 'Escalate')).toBe(true);

    // Either the original approver or the escalation target may now act (ADD).
    const a = await approve(companyId, d.id, actorOf(GM), 'escalated approval');
    expect(a.currentLevel).toBe(2);

    // A second breach with GM (no manager) as target → hop 2 vacant → exhausted, still Pending, no auto-approve.
    await prisma.workflowRequest.update({ where: { id: d.id }, data: { currentLevel: 1, currentStatus: 'Pending Approval', dueAt: past, slaBreachCount: 1 } });
    await prisma.workflowSlot.updateMany({ where: { requestId: d.id, levelNo: 1, status: 'Approved' }, data: { status: 'Pending' } });
    const second = await runEscalationSweep(companyId);
    expect(second.exhausted).toBeGreaterThanOrEqual(1);
    const after = await prisma.workflowRequest.findUnique({ where: { id: d.id } });
    expect(after!.escalationExhausted).toBe(true);
    expect(after!.currentStatus).toBe('Pending Approval');
    const vacantRow = await prisma.workflowEscalation.findFirst({ where: { requestId: d.id, hopNo: 2 } });
    expect(vacantRow!.toApproverEmpId).toBeNull();
    expect(vacantRow!.reasonText).toBe('TARGET_VACANT');
  });
});

describe('platform snapshot — service against the DB', () => {
  it('takeSnapshot / readSnapshot / verifySnapshot / supersedeSnapshot', async () => {
    const actor: PlatformActor = { userId: MGR.userId, employeeId: MGR.id };
    const content = { salary: { basic: new Prisma.Decimal('18000.00'), hra: 7200 }, leave: { earnedLeaveBalance: 11.5 } };
    const snap = await takeSnapshot({ companyId, snapshotTypeCode: 'FNF_INPUT_FREEZE', sourceEntityType: 'FnfSettlement', sourceEntityId: 0, content, actor });
    createdSnapshotIds.push(snap.id);
    expect(snap.sha256Hash).toMatch(/^[0-9a-f]{64}$/);

    const read = await readSnapshot(companyId, snap.id);
    expect(read!.content).toEqual({ leave: { earnedLeaveBalance: 11.5 }, salary: { basic: '18000', hra: 7200 } });
    expect(await verifySnapshot(companyId, snap.id)).toBe('INTACT');
    expect(await verifySnapshot(companyId + 1000, snap.id)).toBe('MISSING');
    expect(await readSnapshot(companyId + 1000, snap.id)).toBeNull();

    const sup = await supersedeSnapshot({ companyId, id: snap.id, reason: 'FNF_REOPEN approved — leave balance corrected', actor, newContent: { ...content, leave: { earnedLeaveBalance: 13.5 } } });
    createdSnapshotIds.push(sup.id);
    const old = await readSnapshot(companyId, snap.id);
    expect(old!.supersededById).toBe(sup.id);
    expect(old!.content).toEqual(read!.content); // never modified
    await expect(supersedeSnapshot({ companyId, id: snap.id, reason: 'again', actor, newContent: {} })).rejects.toMatchObject({ status: 409 });

    // Tamper → DIVERGENT.
    await prisma.configSnapshot.update({ where: { id: sup.id }, data: { contentJson: '{"leave":{"earnedLeaveBalance":99}}' } });
    expect(await verifySnapshot(companyId, sup.id)).toBe('DIVERGENT');
  });
});
