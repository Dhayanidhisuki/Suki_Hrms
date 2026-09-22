/**
 * Segregation of duties through the real F&F route handlers (TESTCO).
 *
 * The unit tests cover the rule; these cover that the routes actually consult
 * it, stamp the actor they were missing, and honour the company switch. A
 * control that exists only in a helper nobody calls is not a control.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { ctx, req, testTenant, type TestAuth } from './employee-helpers';
import { POST as approve } from '@/app/api/payroll/fnf/[id]/approve/route';
import { POST as financeVerify } from '@/app/api/payroll/fnf/[id]/finance-verify/route';
import { POST as markPaid } from '@/app/api/payroll/fnf/[id]/mark-paid/route';

let auth: TestAuth;
let companyId: number;
let employeeId: number;
let exitId: number;
let settlementId: number;
let originalConfig: { approvalStages: string; enforceSegregationOfDuties: boolean } | null = null;

const OTHER_USER = 999_999; // a user id that is not the acting admin

async function setConfig(approvalStages: string, enforceSegregationOfDuties: boolean) {
  await prisma.fullAndFinalConfig.upsert({
    where: { companyId },
    create: { companyId, approvalStages, enforceSegregationOfDuties },
    update: { approvalStages, enforceSegregationOfDuties },
  });
}

async function setSettlement(data: Record<string, unknown>) {
  await prisma.fnFSettlement.update({ where: { id: settlementId }, data });
}

beforeAll(async () => {
  const t = await testTenant();
  auth = t.adminAuth;
  companyId = t.companyId;
  const existing = await prisma.fullAndFinalConfig.findUnique({ where: { companyId } });
  originalConfig = existing
    ? { approvalStages: existing.approvalStages, enforceSegregationOfDuties: existing.enforceSegregationOfDuties }
    : null;

  const emp = await prisma.employee.create({
    data: {
      companyId,
      employeeCode: `FNFSOD${Date.now().toString(36)}`.slice(0, 20),
      firstName: 'FnfSod',
      lastName: 'Case',
    },
  });
  employeeId = emp.id;
  const exit = await prisma.exitInterview.create({
    data: { employeeId, exitDate: new Date('2026-09-15'), exitType: 'resignation', clearanceStatus: 'CLEARED' },
  });
  exitId = exit.id;
  const s = await prisma.fnFSettlement.create({
    data: {
      companyId,
      employeeId,
      exitInterviewId: exitId,
      lastWorkingDay: new Date('2026-09-15'),
      status: 'submitted',
      totalPayable: 30000,
      totalRecovery: 0,
      netPayable: 30000,
    },
  });
  settlementId = s.id;
});

beforeEach(async () => {
  await setConfig('HR_FINANCE', true);
  await setSettlement({
    status: 'submitted',
    submittedByUserId: null,
    managerApprovedByUserId: null,
    approvedByUserId: null,
    financeVerifiedByUserId: null,
    paidByUserId: null,
  });
});

afterAll(async () => {
  await prisma.fnFSettlementLine.deleteMany({ where: { settlementId } });
  await prisma.fnFSettlement.deleteMany({ where: { id: settlementId } });
  await prisma.exitInterview.deleteMany({ where: { id: exitId } });
  await prisma.employeeActivity.deleteMany({ where: { employeeId } });
  await prisma.employee.deleteMany({ where: { id: employeeId } });
  if (originalConfig) await setConfig(originalConfig.approvalStages, originalConfig.enforceSegregationOfDuties);
  else await prisma.fullAndFinalConfig.deleteMany({ where: { companyId } });
});

describe('F&F segregation of duties through the routes', () => {
  it('refuses to let the submitter approve their own settlement', async () => {
    await setSettlement({ submittedByUserId: auth.userId });
    const res = await approve(
      req(`http://localhost/api/payroll/fnf/${settlementId}/approve`, { method: 'POST', auth }),
      ctx(settlementId),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/segregation of duties/i);

    const after = await prisma.fnFSettlement.findUnique({ where: { id: settlementId } });
    expect(after!.status, 'a refused approval must not advance the settlement').toBe('submitted');
  });

  it('allows approval when someone else submitted, and stamps the approver', async () => {
    await setSettlement({ submittedByUserId: OTHER_USER });
    const res = await approve(
      req(`http://localhost/api/payroll/fnf/${settlementId}/approve`, { method: 'POST', auth }),
      ctx(settlementId),
    );
    expect(res.status).toBe(200);
    const after = await prisma.fnFSettlement.findUnique({ where: { id: settlementId } });
    expect(after!.status).toBe('approved');
    expect(after!.approvedByUserId).toBe(auth.userId);
  });

  it('refuses to let the approver finance-verify their own approval', async () => {
    await setSettlement({ status: 'approved', approvedByUserId: auth.userId });
    const res = await financeVerify(
      req(`http://localhost/api/payroll/fnf/${settlementId}/finance-verify`, { method: 'POST', auth }),
      ctx(settlementId),
    );
    expect(res.status).toBe(403);
    const after = await prisma.fnFSettlement.findUnique({ where: { id: settlementId } });
    expect(after!.status).toBe('approved');
  });

  it('refuses to let the finance verifier also mark it paid, and stamps the payer when allowed', async () => {
    await setSettlement({ status: 'finance_verified', financeVerifiedByUserId: auth.userId });
    const blocked = await markPaid(
      req(`http://localhost/api/payroll/fnf/${settlementId}/mark-paid`, { method: 'POST', auth, body: { paymentReference: 'UTR-SOD' } }),
      ctx(settlementId),
    );
    expect(blocked.status).toBe(403);

    await setSettlement({ financeVerifiedByUserId: OTHER_USER });
    const allowed = await markPaid(
      req(`http://localhost/api/payroll/fnf/${settlementId}/mark-paid`, { method: 'POST', auth, body: { paymentReference: 'UTR-SOD' } }),
      ctx(settlementId),
    );
    expect(allowed.status).toBe(200);
    const after = await prisma.fnFSettlement.findUnique({ where: { id: settlementId } });
    expect(after!.status).toBe('paid');
    expect(after!.paidByUserId, 'the payer must be recorded, or the next check has nothing to compare').toBe(auth.userId);
  });

  it('a company that switches the control off can run the chain single-handed', async () => {
    await setConfig('HR_FINANCE', false);
    await setSettlement({ submittedByUserId: auth.userId });

    const approved = await approve(
      req(`http://localhost/api/payroll/fnf/${settlementId}/approve`, { method: 'POST', auth }),
      ctx(settlementId),
    );
    expect(approved.status).toBe(200);

    const verified = await financeVerify(
      req(`http://localhost/api/payroll/fnf/${settlementId}/finance-verify`, { method: 'POST', auth }),
      ctx(settlementId),
    );
    expect(verified.status).toBe(200);

    const paid = await markPaid(
      req(`http://localhost/api/payroll/fnf/${settlementId}/mark-paid`, { method: 'POST', auth, body: { paymentReference: 'UTR-SOLO' } }),
      ctx(settlementId),
    );
    expect(paid.status).toBe(200);
  });

  it('is enforced by default for a company with no config row at all', async () => {
    await prisma.fullAndFinalConfig.deleteMany({ where: { companyId } });
    await setSettlement({ submittedByUserId: auth.userId });
    const res = await approve(
      req(`http://localhost/api/payroll/fnf/${settlementId}/approve`, { method: 'POST', auth }),
      ctx(settlementId),
    );
    expect(res.status, 'no config must mean the control is on, not absent').toBe(403);
  });
});
