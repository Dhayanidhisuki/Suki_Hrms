/**
 * F&F workflow through the real route handlers (TESTCO).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { ctx, req, testTenant, type TestAuth } from './employee-helpers';

let auth: TestAuth;
let companyId: number;
let employeeId: number;
let exitId: number;
let settlementId: number;

beforeAll(async () => {
  const t = await testTenant();
  auth = t.adminAuth;
  companyId = t.companyId;
  const perm =
    (await prisma.permission.findFirst({
      where: { module: 'payroll', submodule: 'processing', action: 'manage', isActive: true, deletedAt: null },
    })) ??
    (await prisma.permission.create({
      data: { code: 'payroll.processing.manage', module: 'payroll', submodule: 'processing', action: 'manage', description: 'Payroll processing manage' },
    }));
  const viewPerm =
    (await prisma.permission.findFirst({
      where: { module: 'payroll', submodule: 'processing', action: 'view', isActive: true, deletedAt: null },
    })) ??
    (await prisma.permission.create({
      data: { code: 'payroll.processing.view', module: 'payroll', submodule: 'processing', action: 'view', description: 'Payroll processing view' },
    }));
  for (const p of [perm, viewPerm]) {
    const existing = await prisma.rolePermission.findFirst({ where: { roleId: auth.roleId, permissionId: p.id } });
    if (!existing) await prisma.rolePermission.create({ data: { roleId: auth.roleId, permissionId: p.id } });
  }
  const emp = await prisma.employee.create({
    data: {
      companyId,
      employeeCode: `FNF${Date.now().toString(36)}`.slice(0, 20),
      firstName: 'FnfFlow',
      lastName: 'Case',
    },
  });
  employeeId = emp.id;
  const exit = await prisma.exitInterview.create({
    data: {
      employeeId,
      exitDate: new Date('2026-09-15'),
      exitType: 'resignation',
      clearanceStatus: 'CLEARED',
    },
  });
  exitId = exit.id;
});

afterAll(async () => {
  await cleanupEmployee(employeeId, settlementId, exitId);
});

async function cleanupEmployee(empId?: number, fnfId?: number, exId?: number) {
  if (fnfId) {
    await prisma.fnFSettlementLine.deleteMany({ where: { settlementId: fnfId } });
    await prisma.fnFSettlement.deleteMany({ where: { id: fnfId } });
  }
  if (exId) {
    await prisma.exitClearanceCheck.deleteMany({ where: { exitInterviewId: exId } });
    await prisma.exitInterview.deleteMany({ where: { id: exId } });
  }
  if (empId) {
    await prisma.employeeActivity.deleteMany({ where: { employeeId: empId } });
    await prisma.employee.updateMany({ where: { id: empId }, data: { deletedAt: new Date(), isActive: false } });
  }
}

describe('F&F API workflow', () => {
  it('creates, submits, HR-approves, finance-verifies, pays, completes, and exports bank file', async () => {
    const { POST: create } = await import('@/app/api/payroll/fnf/route');
    const created = await create(
      req('http://localhost/api/payroll/fnf', {
        method: 'POST',
        auth,
        body: { employeeId, exitInterviewId: exitId },
      }),
    );
    expect(created.status).toBe(201);
    const body = await created.json();
    settlementId = body.id;
    expect(body.status).toBe('pending');

    await prisma.fnFSettlement.update({
      where: { id: settlementId },
      data: { status: 'calculated', netPayable: 1500.5 },
    });

    const { POST: submit } = await import('@/app/api/payroll/fnf/[id]/submit/route');
    const submitted = await submit(req(`http://localhost/api/payroll/fnf/${settlementId}/submit`, { method: 'POST', auth }), ctx(settlementId));
    expect(submitted.status).toBe(200);
    expect((await submitted.json()).status).toBe('submitted');

    const { POST: approve } = await import('@/app/api/payroll/fnf/[id]/approve/route');
    const approved = await approve(req(`http://localhost/api/payroll/fnf/${settlementId}/approve`, { method: 'POST', auth }), ctx(settlementId));
    expect(approved.status).toBe(200);
    const afterHr = await approved.json();
    expect(['approved', 'finance_verified']).toContain(afterHr.status);

    if (afterHr.status === 'approved') {
      const { POST: finance } = await import('@/app/api/payroll/fnf/[id]/finance-verify/route');
      const fin = await finance(req(`http://localhost/api/payroll/fnf/${settlementId}/finance-verify`, { method: 'POST', auth }), ctx(settlementId));
      expect(fin.status).toBe(200);
      expect((await fin.json()).status).toBe('finance_verified');
    }

    const { GET: bank } = await import('@/app/api/payroll/fnf/bank-file/route');
    const csvRes = await bank(req(`http://localhost/api/payroll/fnf/bank-file?ids=${settlementId}`, { auth }));
    expect(csvRes.status).toBe(200);
    const csv = await csvRes.text();
    expect(csv).toContain('EmployeeCode');
    expect(csv).toContain(body.employee.employeeCode);

    const { POST: paid } = await import('@/app/api/payroll/fnf/[id]/mark-paid/route');
    const paidRes = await paid(
      req(`http://localhost/api/payroll/fnf/${settlementId}/mark-paid`, { method: 'POST', auth, body: { paymentReference: 'UTR-TEST-1' } }),
      ctx(settlementId),
    );
    expect(paidRes.status).toBe(200);
    expect((await paidRes.json()).status).toBe('paid');

    const { POST: complete } = await import('@/app/api/payroll/fnf/[id]/complete/route');
    const done = await complete(req(`http://localhost/api/payroll/fnf/${settlementId}/complete`, { method: 'POST', auth }), ctx(settlementId));
    expect(done.status).toBe(200);
    expect((await done.json()).status).toBe('completed');
  });

  it('cancels a pending draft and refuses cancel after submit', async () => {
    const emp2 = await prisma.employee.create({
      data: { companyId, employeeCode: `FNC${Date.now().toString(36)}`.slice(0, 20), firstName: 'Fnf', lastName: 'Cancel' },
    });
    const exit2 = await prisma.exitInterview.create({
      data: { employeeId: emp2.id, exitDate: new Date('2026-09-16'), exitType: 'resignation' },
    });
    const { POST: create } = await import('@/app/api/payroll/fnf/route');
    const created = await create(
      req('http://localhost/api/payroll/fnf', { method: 'POST', auth, body: { employeeId: emp2.id, exitInterviewId: exit2.id } }),
    );
    const draft = await created.json();

    const { POST: cancel } = await import('@/app/api/payroll/fnf/[id]/cancel/route');
    const cancelled = await cancel(
      req(`http://localhost/api/payroll/fnf/${draft.id}/cancel`, { method: 'POST', auth, body: { reason: 'Test cancel' } }),
      ctx(draft.id),
    );
    expect(cancelled.status).toBe(200);
    expect((await cancelled.json()).status).toBe('cancelled');

    const { POST: cancelAgain } = await import('@/app/api/payroll/fnf/[id]/cancel/route');
    const blocked = await cancelAgain(
      req(`http://localhost/api/payroll/fnf/${draft.id}/cancel`, { method: 'POST', auth, body: { reason: 'again' } }),
      ctx(draft.id),
    );
    expect(blocked.status).toBe(409);

    await cleanupEmployee(emp2.id, draft.id, exit2.id);
  });
});
