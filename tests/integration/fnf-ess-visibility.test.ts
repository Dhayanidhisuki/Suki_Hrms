/**
 * What an employee may see of their own F&F settlement, in the TESTCO tenant.
 *
 * The employee reads any number on this page as a promise. Payroll's working
 * states — pending, calculated, pending_manager, submitted — carry figures
 * that are still moving, so the rule is that ESS never runs ahead of what the
 * notification catalogue has already told the employee.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { req, testTenant, type TestAuth } from './employee-helpers';
import { GET as essList } from '@/app/api/ess/fnf/route';
import { GET as essPdf } from '@/app/api/ess/fnf/pdf/route';

let auth: TestAuth;
let companyId: number;
let employeeId: number;
let userId: number;
let exitId: number;
let settlementId: number;

/** Auth for the subject employee's own login, not the admin's. */
function selfAuth(): TestAuth {
  return { ...auth, userId };
}

async function setStatus(status: string) {
  await prisma.fnFSettlement.update({ where: { id: settlementId }, data: { status } });
}

async function listForSelf() {
  const res = await essList(req('http://localhost/api/ess/fnf', { auth: selfAuth() }));
  expect(res.status).toBe(200);
  return ((await res.json()).data ?? []) as {
    id: number;
    status: string;
    netPayable?: unknown;
    totalPayable?: unknown;
    amountsWithheld?: boolean;
    kunStatement?: unknown;
    lines?: unknown[];
  }[];
}

beforeAll(async () => {
  const t = await testTenant();
  auth = t.adminAuth;
  companyId = t.companyId;

  const user = await prisma.user.create({
    data: {
      companyId,
      roleId: auth.roleId,
      email: `fnf-ess-${Date.now().toString(36)}@example.test`,
      passwordHash: 'not-a-real-hash',
    },
  });
  userId = user.id;

  const emp = await prisma.employee.create({
    data: {
      companyId,
      userId: user.id,
      employeeCode: `FNFESS${Date.now().toString(36)}`.slice(0, 20),
      firstName: 'FnfEss',
      lastName: 'Subject',
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
      status: 'calculated',
      totalPayable: 42000,
      totalRecovery: 2000,
      netPayable: 40000,
    },
  });
  settlementId = s.id;
});

afterAll(async () => {
  await prisma.fnFSettlementLine.deleteMany({ where: { settlementId } });
  await prisma.fnFSettlement.deleteMany({ where: { id: settlementId } });
  await prisma.exitInterview.deleteMany({ where: { id: exitId } });
  await prisma.employeeActivity.deleteMany({ where: { employeeId } });
  await prisma.employee.deleteMany({ where: { id: employeeId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe('ESS F&F visibility', () => {
  it.each(['pending', 'calculated', 'pending_manager', 'submitted', 'cancelled'])(
    'hides a settlement in %s — payroll is still working on the figure',
    async (status) => {
      await setStatus(status);
      const rows = await listForSelf();
      expect(rows.map((r) => r.id)).not.toContain(settlementId);
    },
  );

  it.each(['approved', 'finance_verified', 'paid', 'completed'])(
    'shows the full statement in %s — HR has committed the figure',
    async (status) => {
      await setStatus(status);
      const rows = await listForSelf();
      const row = rows.find((r) => r.id === settlementId);
      expect(row, `a ${status} settlement must be visible to its own employee`).toBeDefined();
      expect(row!.amountsWithheld).toBeFalsy();
      expect(Number(row!.netPayable)).toBe(40000);
    },
  );

  it.each(['on_hold', 'rejected', 'reopened'])(
    'shows %s as status-only — the employee was notified, but the amounts are mid-revision',
    async (status) => {
      await setStatus(status);
      const rows = await listForSelf();
      const row = rows.find((r) => r.id === settlementId);
      expect(row, 'the employee is told about this state, so ESS must not deny it exists').toBeDefined();
      expect(row!.amountsWithheld).toBe(true);
      expect(row!.netPayable, 'a provisional net must not be shown as though it were final').toBeUndefined();
      expect(row!.totalPayable).toBeUndefined();
      expect(row!.kunStatement ?? null).toBeNull();
      expect(row!.lines ?? []).toHaveLength(0);
    },
  );

  it('refuses the PDF while the figures are not committed', async () => {
    await setStatus('calculated');
    const hidden = await essPdf(req(`http://localhost/api/ess/fnf/pdf?id=${settlementId}`, { auth: selfAuth() }));
    expect(hidden.status).toBe(404);

    await setStatus('on_hold');
    const withheld = await essPdf(req(`http://localhost/api/ess/fnf/pdf?id=${settlementId}`, { auth: selfAuth() }));
    expect(withheld.status).toBe(404);
  });

  it('serves the PDF once HR has approved', async () => {
    await setStatus('approved');
    const res = await essPdf(req(`http://localhost/api/ess/fnf/pdf?id=${settlementId}`, { auth: selfAuth() }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
  });
});
