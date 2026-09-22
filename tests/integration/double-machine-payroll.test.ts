/**
 * Workforce > Benefits > Double Machine Incentive → payslip.
 *
 * Until this wiring existed, nothing HR keyed on /payroll/processing/double-machine
 * reached a payslip: payroll fed DM_INCENTIVE from the per-day DoubleMachineEntry
 * table, which has no create path anywhere, while the monthly DoubleMachineIncentive
 * table this module writes was read only by the OT & Other Incentive register.
 *
 * These tests calculate a throwaway payroll run twice — once clean, once with a
 * module row — and assert the delta, so they prove the money actually moves rather
 * than that a particular component happens to exist.
 *
 * Only `complete` rows pay. `hold` is the module's explicit do-not-pay, and
 * `process` / `draft` are unfinished.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { calculatePayrollRun } from '@/lib/payrollCalculation';

// PayrollRun is unique per (company, year, month) and every period that has
// attendance already has one, so the tests borrow the 2026-10 DRAFT run —
// which exists with zero lines — and clone one finalized attendance summary
// into it. Everything created here is torn down in afterAll, leaving that run
// back at zero lines.
const SRC_YEAR = 2026;
const SRC_MONTH = 8;
const YEAR = 2026;
const MONTH = 10;

let runId = 0;
let companyId = 0;
let employeeId = 0;
let clonedSummary = false;
let originalRunStatus = 'DRAFT';

beforeAll(async () => {
  const run = await prisma.payrollRun.findFirstOrThrow({ where: { year: YEAR, month: MONTH } });
  runId = run.id;
  companyId = run.companyId;
  // calculatePayrollRun advances DRAFT -> CALCULATED, so a previous execution
  // of this file leaves it CALCULATED; both are acceptable to borrow. What we
  // must never touch is an APPROVED or LOCKED run.
  expect(['DRAFT', 'CALCULATED'], `borrowed run is ${run.status}`).toContain(run.status);
  originalRunStatus = run.status;

  const srcRun = await prisma.payrollRun.findFirstOrThrow({ where: { year: SRC_YEAR, month: SRC_MONTH } });
  employeeId = (await prisma.payrollLine.findFirstOrThrow({
    where: { payrollRunId: srcRun.id }, select: { employeeId: true },
  })).employeeId;

  const src = await prisma.monthlyAttendanceSummary.findUniqueOrThrow({
    where: { employeeId_year_month: { employeeId, year: SRC_YEAR, month: SRC_MONTH } },
  });
  const existing = await prisma.monthlyAttendanceSummary.findUnique({
    where: { employeeId_year_month: { employeeId, year: YEAR, month: MONTH } },
  });
  if (!existing) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = src;
    await prisma.monthlyAttendanceSummary.create({ data: { ...rest, year: YEAR, month: MONTH } });
    clonedSummary = true;
  }
}, 120_000);

afterAll(async () => {
  await prisma.doubleMachineIncentive.deleteMany({ where: { employeeId, year: YEAR, month: MONTH } });
  if (runId) {
    await prisma.payrollLineComponent.deleteMany({ where: { payrollLine: { payrollRunId: runId } } });
    await prisma.payrollLine.deleteMany({ where: { payrollRunId: runId } });
  }
  if (clonedSummary) {
    await prisma.monthlyAttendanceSummary.deleteMany({ where: { employeeId, year: YEAR, month: MONTH } });
  }
  // Put the borrowed run back exactly as it was found — calculating it moved
  // the status, and leaving that behind broke this file's own precondition.
  if (runId) {
    await prisma.payrollRun.update({ where: { id: runId }, data: { status: originalRunStatus } });
  }
});

async function lineFor() {
  return prisma.payrollLine.findFirst({
    where: { payrollRunId: runId, employeeId },
    select: { otherEarningsTotal: true, netSalary: true, status: true },
  });
}

/** Recalculate the borrowed run with the module in a given state. */
async function recalcWith(row: { status: string; doubleMachine?: number; attendanceBonus?: number; shiftIncentive?: number; otWeeklyInc?: number; employeeR?: number } | null) {
  await prisma.doubleMachineIncentive.deleteMany({ where: { employeeId, year: YEAR, month: MONTH } });
  if (row) {
    await prisma.doubleMachineIncentive.create({
      data: {
        companyId, employeeId, year: YEAR, month: MONTH, status: row.status,
        doubleMachine: row.doubleMachine ?? 0, attendanceBonus: row.attendanceBonus ?? 0,
        shiftIncentive: row.shiftIncentive ?? 0, otWeeklyInc: row.otWeeklyInc ?? 0,
        employeeR: row.employeeR ?? 0,
      },
    });
  }
  await calculatePayrollRun(runId);
  return lineFor();
}

describe('Double Machine module → payroll', () => {
  it('pays a `complete` row and itemises it, moving net salary by exactly that amount', async () => {
    const before = await recalcWith(null);
    expect(before, 'baseline line should exist').not.toBeNull();
    expect(before!.status, 'employee must not be on HOLD or the test proves nothing').toBe('OK');

    // 1,000 + 200 + 300 + 400 + 500 = 2,400
    const after = await recalcWith({
      status: 'complete',
      doubleMachine: 1000, attendanceBonus: 200, shiftIncentive: 300,
      otWeeklyInc: 400, employeeR: 500,
    });

    expect(Number(after!.otherEarningsTotal) - Number(before!.otherEarningsTotal)).toBe(2400);
    expect(Number(after!.netSalary) - Number(before!.netSalary)).toBe(2400);

    // Where the salary component master exists the amount is itemised under
    // it, rather than disappearing into the "Other Earnings" catch-all.
    const line = await prisma.payrollLine.findFirstOrThrow({
      where: { payrollRunId: runId, employeeId },
      select: { components: { select: { amount: true, salaryComponent: { select: { code: true } } } } },
    });
    const byCode = new Map(line.components.map((c) => [c.salaryComponent.code, Number(c.amount)]));
    for (const [code, amount] of [['DM_INCENTIVE', 1000], ['ATT_BONUS', 200], ['SHIFT_BONUS', 300]] as const) {
      const master = await prisma.salaryComponent.findUnique({ where: { companyId_code: { companyId, code } } });
      if (master) expect(byCode.get(code), `${code} should be itemised`).toBe(amount);
    }
  }, 300_000);

  it('pays nothing for a `hold` row', async () => {
    const before = await recalcWith(null);
    const after = await recalcWith({
      status: 'hold',
      doubleMachine: 9999, attendanceBonus: 9999, shiftIncentive: 9999,
      otWeeklyInc: 9999, employeeR: 9999,
    });
    expect(Number(after!.otherEarningsTotal)).toBe(Number(before!.otherEarningsTotal));
    expect(Number(after!.netSalary)).toBe(Number(before!.netSalary));
  }, 300_000);

  it('pays nothing for a `process` row — keyed is not the same as approved', async () => {
    const before = await recalcWith(null);
    const after = await recalcWith({ status: 'process', doubleMachine: 750 });
    expect(Number(after!.otherEarningsTotal)).toBe(Number(before!.otherEarningsTotal));
    expect(Number(after!.netSalary)).toBe(Number(before!.netSalary));
  }, 300_000);
});

/**
 * Period locking. Before checkPeriodEditable existed, no input module called
 * the payroll guard at all — an incentive could be keyed or approved after the
 * payslips for that month had already gone out.
 */
describe('Double Machine module — locked periods', () => {
  it('refuses writes once the payroll run for the period is APPROVED or LOCKED', async () => {
    const { checkPeriodEditable } = await import('@/lib/payrollGuard');

    // 2026-08 is LOCKED in this database.
    const locked = await prisma.payrollRun.findFirstOrThrow({ where: { year: 2026, month: 8 } });
    expect(locked.status).toBe('LOCKED');
    const blocked = await checkPeriodEditable(locked.companyId, 2026, 8);
    expect(blocked, 'a locked period must be refused').not.toBeNull();
    expect(blocked!.status).toBe(409);

    // The borrowed DRAFT period stays writable.
    expect(await checkPeriodEditable(locked.companyId, YEAR, MONTH)).toBeNull();

    // A period with no run at all has nothing to protect.
    expect(await checkPeriodEditable(locked.companyId, 2099, 12)).toBeNull();
  }, 60_000);
});

/**
 * The approval route end-to-end: permission, transition rules, attribution and
 * the activity trail, through the real handler rather than a direct DB write.
 */
describe('Double Machine module — approval route', () => {
  it('approves through the API, stamps who did it, and refuses an illegal transition', async () => {
    const { getAdminAuth, makeRequest } = await import('./fixtures');
    const { POST } = await import('@/app/api/payroll/double-machine/bulk-status/route');
    const auth = await getAdminAuth();

    // (employeeId, year, month) is unique — clear any row a previous test or a
    // manual check left behind rather than colliding with it.
    await prisma.doubleMachineIncentive.deleteMany({ where: { employeeId, year: YEAR, month: MONTH } });
    const row = await prisma.doubleMachineIncentive.create({
      data: {
        companyId, employeeId, year: YEAR, month: MONTH, status: 'process',
        doubleMachine: 100, attendanceBonus: 0, shiftIncentive: 0, otWeeklyInc: 0, employeeR: 0,
      },
    });

    try {
      const res = await POST(makeRequest('http://localhost/api/payroll/double-machine/bulk-status', {
        method: 'POST', auth, companyId, body: { ids: [row.id], action: 'approve' },
      }));
      expect(res.status, await res.clone().text()).toBe(200);

      const after = await prisma.doubleMachineIncentive.findUniqueOrThrow({ where: { id: row.id } });
      expect(after.status).toBe('complete');
      expect(after.approvedByUserId, 'the approver must be recorded').toBe(auth.userId);
      expect(after.approvedAt).not.toBeNull();

      const trail = await prisma.employeeActivity.findMany({
        where: { module: 'double-machine', relatedRecordId: row.id },
      });
      expect(trail.length, 'the approval must leave an audit trail').toBeGreaterThan(0);

      // Approving an already-complete row is refused, not silently re-applied.
      const again = await POST(makeRequest('http://localhost/api/payroll/double-machine/bulk-status', {
        method: 'POST', auth, companyId, body: { ids: [row.id], action: 'approve' },
      }));
      expect(again.status).toBe(409);
      const body = await again.json();
      expect(body.rejected?.[0]?.reason ?? body.error).toContain('Already complete');
    } finally {
      await prisma.employeeActivity.deleteMany({ where: { module: 'double-machine', relatedRecordId: row.id } });
      await prisma.doubleMachineIncentive.deleteMany({ where: { id: row.id } });
    }
  }, 120_000);
});
