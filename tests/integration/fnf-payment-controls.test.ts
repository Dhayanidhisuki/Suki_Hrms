/**
 * Payment controls on Full & Final, in the TESTCO tenant.
 *
 * The bank file is the instruction that actually moves money, so it is the
 * one surface where a missing guard costs cash rather than a bad screen.
 * These tests pin the two things that must hold: nothing reaches the file
 * before the approval chain the company configured is complete, and nothing
 * reaches it as a negative credit line.
 *
 * Every settlement here is created directly through Prisma rather than the
 * calculate route, because FnFSettlementLine cannot currently accept inserts
 * (see fnf-identity-blocker.test.ts). These tests are about the guards, not
 * the arithmetic, so they set stored totals explicitly.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { ctx, req, testTenant, type TestAuth } from './employee-helpers';
import { GET as bankFile } from '@/app/api/payroll/fnf/bank-file/route';
import { GET as listSettlements } from '@/app/api/payroll/fnf/route';
import { POST as calculate } from '@/app/api/payroll/fnf/[id]/calculate/route';

let auth: TestAuth;
let companyId: number;
let originalStages: string | null = null;
const employeeIds: number[] = [];
const exitIds: number[] = [];
const settlementIds: number[] = [];

async function makeSettlement(opts: { status: string; netPayable: number; tag: string }) {
  const emp = await prisma.employee.create({
    data: {
      companyId,
      employeeCode: `FNFPC${Date.now().toString(36)}${employeeIds.length}`.slice(0, 20),
      firstName: 'FnfPay',
      lastName: opts.tag,
    },
  });
  employeeIds.push(emp.id);
  const exit = await prisma.exitInterview.create({
    data: { employeeId: emp.id, exitDate: new Date('2026-09-15'), exitType: 'resignation', clearanceStatus: 'CLEARED' },
  });
  exitIds.push(exit.id);
  const s = await prisma.fnFSettlement.create({
    data: {
      companyId,
      employeeId: emp.id,
      exitInterviewId: exit.id,
      lastWorkingDay: new Date('2026-09-15'),
      status: opts.status,
      totalPayable: Math.max(opts.netPayable, 0),
      totalRecovery: opts.netPayable < 0 ? Math.abs(opts.netPayable) : 0,
      netPayable: opts.netPayable,
    },
  });
  settlementIds.push(s.id);
  return { settlementId: s.id, employeeCode: emp.employeeCode };
}

async function setApprovalStages(stages: string) {
  await prisma.fullAndFinalConfig.upsert({
    where: { companyId },
    create: { companyId, approvalStages: stages },
    update: { approvalStages: stages },
  });
}

/** The exported settlement ids, parsed out of the CSV's SettlementId column. */
async function exportedIds(): Promise<number[]> {
  // Scoped to this suite's own settlements. Unfiltered, the file returns
  // every payable settlement in the tenant, so anything another suite leaves
  // behind changes the answer.
  const res = await bankFile(
    req(`http://localhost/api/payroll/fnf/bank-file?ids=${settlementIds.join(',')}`, { auth }),
  );
  expect(res.status).toBe(200);
  const csv = await res.text();
  const [header, ...rows] = csv.trim().split('\n');
  const col = header.split(',').indexOf('SettlementId');
  return rows.filter(Boolean).map((r) => Number(r.split(',')[col]));
}

beforeAll(async () => {
  const t = await testTenant();
  auth = t.adminAuth;
  companyId = t.companyId;
  const existing = await prisma.fullAndFinalConfig.findUnique({ where: { companyId } });
  originalStages = existing?.approvalStages ?? null;
});

afterAll(async () => {
  if (settlementIds.length) {
    await prisma.fnFSettlementLine.deleteMany({ where: { settlementId: { in: settlementIds } } });
    await prisma.fnFSettlement.deleteMany({ where: { id: { in: settlementIds } } });
  }
  if (exitIds.length) await prisma.exitInterview.deleteMany({ where: { id: { in: exitIds } } });
  if (employeeIds.length) {
    // The calculate route writes an EmployeeActivity row, and that FK has no
    // cascade — leaving it behind aborts the teardown and strands every
    // fixture employee in the tenant.
    await prisma.employeeActivity.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await prisma.employee.deleteMany({ where: { id: { in: employeeIds } } });
  }
  // Put the tenant's approval chain back exactly as it was found.
  if (originalStages != null) await setApprovalStages(originalStages);
  else await prisma.fullAndFinalConfig.deleteMany({ where: { companyId } });
});

describe('F&F bank file payment controls', () => {
  it('under HR_FINANCE, an HR-approved settlement is NOT payable until finance verifies', async () => {
    await setApprovalStages('HR_FINANCE');
    const approved = await makeSettlement({ status: 'approved', netPayable: 5000, tag: 'Approved' });
    const verified = await makeSettlement({ status: 'finance_verified', netPayable: 6000, tag: 'Verified' });

    const ids = await exportedIds();
    expect(ids, 'finance-verified settlements belong in the bank file').toContain(verified.settlementId);
    expect(
      ids,
      'an HR-approved settlement still awaiting finance verification must not reach the bank file',
    ).not.toContain(approved.settlementId);
  });

  it('under HR-only approval, an approved settlement IS payable', async () => {
    await setApprovalStages('HR');
    const approved = await makeSettlement({ status: 'approved', netPayable: 7000, tag: 'HrOnly' });

    const ids = await exportedIds();
    expect(ids, 'with no finance stage configured, HR approval is the final gate').toContain(approved.settlementId);
  });

  it('never exports a negative net as a bank credit line', async () => {
    await setApprovalStages('HR_FINANCE');
    // Recoveries (notice pay, loan, assets) can exceed dues; netPayable is a
    // plain subtraction with no floor, so this is reachable in production.
    const owing = await makeSettlement({ status: 'finance_verified', netPayable: -2500, tag: 'Owing' });

    const ids = await exportedIds();
    expect(ids, 'a settlement where the employee owes the company is not a payment').not.toContain(owing.settlementId);
  });

  it('excludes a zero net', async () => {
    await setApprovalStages('HR_FINANCE');
    const nil = await makeSettlement({ status: 'finance_verified', netPayable: 0, tag: 'Zero' });

    const ids = await exportedIds();
    expect(ids).not.toContain(nil.settlementId);
  });

  it('the payable worklist follows the same chain as the bank file', async () => {
    await setApprovalStages('HR_FINANCE');
    const approved = await makeSettlement({ status: 'approved', netPayable: 8000, tag: 'Queue' });

    const res = await listSettlements(req('http://localhost/api/payroll/fnf?queue=payable', { auth }));
    expect(res.status).toBe(200);
    const ids = ((await res.json()).data as { id: number }[]).map((r) => r.id);
    expect(
      ids,
      'the payable queue must not offer a settlement the bank file would refuse',
    ).not.toContain(approved.settlementId);
  });
});

describe('F&F calculate input validation', () => {
  it('rejects an out-of-range value instead of silently ignoring it', async () => {
    const s = await makeSettlement({ status: 'pending', netPayable: 0, tag: 'Validate' });
    const res = await calculate(
      req(`http://localhost/api/payroll/fnf/${s.settlementId}/calculate`, {
        method: 'POST',
        auth,
        body: { noticeServedDays: -5 },
      }),
      ctx(s.settlementId),
    );
    // Negative served days used to fall through as "no overrides" and the
    // settlement was recalculated from stored values as if nothing was sent.
    expect(res.status).toBe(400);
  });
});
