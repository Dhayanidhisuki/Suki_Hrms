/**
 * OT & Other Incentive Register tests.
 *
 * Two kinds of check:
 *
 *  1. The register's arithmetic reproduces the reference workbook's own
 *     formula. Three employees with nonzero OT are taken verbatim from
 *     "Overtime Salary Register_February'2026.xlsx" (sheet "Salary Export")
 *     and run through the same expressions the register uses. The source
 *     numbers differ from ours — that workbook was maintained by hand — but
 *     the relationships between the columns must be identical, or our
 *     columns mean something different from HR's.
 *
 *  2. Those same relationships hold across every row the live register
 *     produces, plus the department summary ties back to the register rows.
 */

import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/prisma';
import { computeOtIncentiveRegister, csvCell, csvLine } from '@/lib/payroll/otIncentiveRegister';
import { createTestEmployee, deleteTestEmployee, getAdminAuth } from './fixtures';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Rows copied from the reference workbook, columns in its own order. */
const REFERENCE_ROWS = [
  // empId, name, otHrs, otAmount, otMonInc, otWeeklyInc, dm, att, shift, referral, totOcEar, emplEsi, emplrEsi, totOcNet
  { empId: 173, name: 'HARIKRISHNAN M', otHrs: 31, otAmount: 7085, otMonInc: 0, otWeeklyInc: 0, dm: 0, att: 0, shift: 0, referral: 0, totOcEar: 7085, emplEsi: 53.1375, emplrEsi: 230.2625, totOcNet: 7031.8625 },
  { empId: 216, name: 'DEVI M', otHrs: 84, otAmount: 9386, otMonInc: 1000, otWeeklyInc: 0, dm: 0, att: 0, shift: 0, referral: 0, totOcEar: 10386, emplEsi: 0, emplrEsi: 0, totOcNet: 10386 },
  { empId: 260, name: 'RAVIN KUMAR N', otHrs: 80, otAmount: 9452, otMonInc: 1000, otWeeklyInc: 0, dm: 0, att: 0, shift: 0, referral: 0, totOcEar: 10452, emplEsi: 0, emplrEsi: 0, totOcNet: 10452 },
];

describe('OT & Other Incentive Register — reference workbook arithmetic', () => {
  it('Tot OC Ear is the sum of the OT and incentive columns', () => {
    for (const r of REFERENCE_ROWS) {
      const computed = round2(r.otAmount + r.otMonInc + r.otWeeklyInc + r.dm + r.att + r.shift + r.referral);
      expect(computed, `${r.name} (emp ${r.empId})`).toBe(round2(r.totOcEar));
    }
  });

  it('Tot OC Net is Tot OC Ear minus the employee ESI share', () => {
    for (const r of REFERENCE_ROWS) {
      expect(round2(r.totOcEar - r.emplEsi), `${r.name} (emp ${r.empId})`).toBe(round2(r.totOcNet));
    }
  });

  it('OC ESI is 0.75% / 3.25% of Tot OC Ear where the employee is covered', () => {
    const covered = REFERENCE_ROWS.filter((r) => r.emplEsi > 0);
    expect(covered.length).toBeGreaterThan(0);
    for (const r of covered) {
      expect(round2(r.totOcEar * 0.0075), `${r.name} employee ESI`).toBe(round2(r.emplEsi));
      expect(round2(r.totOcEar * 0.0325), `${r.name} employer ESI`).toBe(round2(r.emplrEsi));
    }
  });

  it('OT Value is OT Amount divided by OT Hrs', () => {
    // Emp 17 in the workbook: 7,497.826923 / 31 = 241.865385
    expect(round2(7497.826923076923 / 31)).toBe(241.87);
    for (const r of REFERENCE_ROWS) {
      expect(round2(r.otAmount / r.otHrs)).toBeGreaterThan(0);
    }
  });
});

describe('OT & Other Incentive Register — CSV quoting', () => {
  it('doubles embedded quotes instead of corrupting the row', () => {
    expect(csvCell('O"Brien')).toBe('"O""Brien"');
    expect(csvCell('plain')).toBe('"plain"');
    expect(csvCell(null)).toBe('""');
    // A quoted value must not end its own field early.
    const line = csvLine(['A"B', 'next']);
    expect(line).toBe('"A""B","next"');
    expect(line.split('","').length).toBe(2);
  });
});

describe('OT & Other Incentive Register — live data invariants', () => {
  it('every row and the department summary satisfy the workbook formulas', async () => {
    const runs = await prisma.payrollRun.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }] });
    expect(runs.length, 'no payroll runs to verify against').toBeGreaterThan(0);

    let rowsChecked = 0;
    let runsWithRows = 0;

    for (const run of runs) {
      const result = await computeOtIncentiveRegister(run.companyId, run.year, run.month);
      expect(result.run, `run ${run.year}-${run.month} should resolve`).not.toBeNull();
      if (result.rows.length === 0) continue;
      runsWithRows++;

      for (const r of result.rows) {
        const where = `${run.year}-${String(run.month).padStart(2, '0')} ${r.employeeCode}`;

        expect(
          round2(r.otAmount + r.otMonthlyIncentive + r.otWeeklyIncentive + r.doubleMachineIncentive
            + r.attendanceBonus + r.shiftIncentive + r.employeeReferral),
          `${where}: Tot OC Ear`
        ).toBe(round2(r.totOcEarnings));

        expect(round2(r.totOcEarnings - r.ocEmployeeEsi), `${where}: Tot OC Net`).toBe(round2(r.totOcNet));

        if (r.otHours > 0) {
          expect(r.otValue, `${where}: OT Value present`).not.toBeNull();
          expect(round2(r.otAmount / r.otHours), `${where}: OT Value`).toBe(r.otValue);
        } else {
          expect(r.otValue, `${where}: OT Value null with no hours`).toBeNull();
        }

        if (result.esiRates && r.ocEmployeeEsi > 0) {
          expect(round2(r.totOcEarnings * (result.esiRates.employee / 100)), `${where}: employee ESI`).toBe(r.ocEmployeeEsi);
          expect(round2(r.totOcEarnings * (result.esiRates.employer / 100)), `${where}: employer ESI`).toBe(r.ocEmployerEsi);
        }

        // Extra Work has no per-employee source and must never be invented.
        expect(r.extraWork, `${where}: Extra Work`).toBe(0);

        // Guard on the manual-fallback's scope. The fallback to HR's
        // DoubleMachineIncentive entry exists ONLY for the three incentive
        // columns; OT Hrs / OT Amount / OT Mon Incentive must always come
        // from computeEmployeeOtForMonth and fall back to zero, never to a
        // manually keyed figure — otherwise the "two sources, one label"
        // problem this report was rebuilt to remove reopens under a colour.
        expect(Object.keys(r.sources).sort(), `${where}: fallback scope`).toEqual(
          ['attendanceBonus', 'doubleMachineIncentive', 'shiftIncentive']
        );
        rowsChecked++;
      }

      // Department summary must be exactly the register rows, regrouped.
      const expected = new Map<string, number>();
      for (const r of result.rows) {
        const key = r.department ?? '—';
        expected.set(key, round2((expected.get(key) ?? 0) + r.totOcEarnings));
      }
      expect(result.departmentSummary.length, `${run.year}-${run.month}: department count`).toBe(expected.size);
      for (const d of result.departmentSummary) {
        expect(d.totOcEarnings, `${run.year}-${run.month} ${d.department}: dept total`).toBeCloseTo(expected.get(d.department) ?? 0, 2);
      }
      const deptSum = result.departmentSummary.reduce((s, d) => s + d.totOcEarnings, 0);
      expect(deptSum, `${run.year}-${run.month}: dept sum ties to grand total`).toBeCloseTo(result.totals.totOcEarnings, 2);
    }

    console.log(`[ot-register] checked ${rowsChecked} rows across ${runsWithRows} run(s) with data`);
    expect(rowsChecked, 'no register rows were checked').toBeGreaterThan(0);
  }, 300_000);

  it('sources the five OC columns from Workforce > Benefits > Double Machine Incentive', async () => {
    const run = await prisma.payrollRun.findFirst({
      where: { year: 2026, month: 8 },
      select: { id: true, companyId: true, year: true, month: true },
    });
    expect(run, 'expected the 2026-08 run to exist').not.toBeNull();
    const line = await prisma.payrollLine.findFirst({
      where: { payrollRunId: run!.id },
      select: { employeeId: true },
    });
    expect(line, 'expected the run to have at least one line').not.toBeNull();
    const employeeId = line!.employeeId;

    // Baseline: the OT figures before any Benefits-module entry exists. They
    // must not move when one is added — that is the whole point of fix #1.
    const before = await computeOtIncentiveRegister(run!.companyId, run!.year, run!.month);
    const baseline = before.rows.find((r) => r.employeeId === employeeId);
    expect(baseline, 'employee missing from the register').toBeDefined();

    const created = await prisma.doubleMachineIncentive.create({
      data: {
        companyId: run!.companyId, employeeId, year: run!.year, month: run!.month,
        doubleMachine: 1234.56, attendanceBonus: 500, shiftIncentive: 250,
        otWeeklyInc: 750, employeeR: 1500, status: 'process',
      },
    });

    try {
      const after = await computeOtIncentiveRegister(run!.companyId, run!.year, run!.month);
      const row = after.rows.find((r) => r.employeeId === employeeId);
      expect(row, 'employee missing after the module entry was added').toBeDefined();

      // The module's figures reach the register, flagged as module-sourced.
      expect(row!.doubleMachineIncentive).toBe(1234.56);
      expect(row!.attendanceBonus).toBe(500);
      expect(row!.shiftIncentive).toBe(250);
      expect(row!.otWeeklyIncentive).toBe(750);
      expect(row!.employeeReferral).toBe(1500);
      expect(row!.sources.doubleMachineIncentive).toBe('manual');
      expect(row!.sources.attendanceBonus).toBe('manual');
      expect(row!.sources.shiftIncentive).toBe('manual');
      expect(row!.remarks).toContain('PROCESS');

      // OT is untouched by anything keyed into the module.
      expect(row!.otHours).toBe(baseline!.otHours);
      expect(row!.otAmount).toBe(baseline!.otAmount);
      expect(row!.otMonthlyIncentive).toBe(baseline!.otMonthlyIncentive);

      // Tot OC Ear picks the new figures up, and stays the documented sum.
      expect(round2(row!.totOcEarnings)).toBe(
        round2(baseline!.totOcEarnings + 1234.56 + 500 + 250 + 750 + 1500)
      );
      expect(round2(row!.totOcEarnings - row!.ocEmployeeEsi)).toBe(round2(row!.totOcNet));

      // The department summary follows the register, not a separate query.
      const dept = after.departmentSummary.find((d) => d.department === (row!.department ?? '—'));
      expect(dept, 'department row missing').toBeDefined();
      expect(dept!.doubleMachineIncentive).toBeGreaterThanOrEqual(1234.56);
    } finally {
      await prisma.doubleMachineIncentive.delete({ where: { id: created.id } });
    }

    expect(await prisma.doubleMachineIncentive.count({ where: { id: created.id } })).toBe(0);
  }, 120_000);

  it('pays zero for a Benefits row marked hold, without touching OT', async () => {
    const run = await prisma.payrollRun.findFirst({
      where: { year: 2026, month: 8 },
      select: { id: true, companyId: true, year: true, month: true },
    });
    const line = await prisma.payrollLine.findFirst({
      where: { payrollRunId: run!.id }, select: { employeeId: true },
    });
    const employeeId = line!.employeeId;

    const before = await computeOtIncentiveRegister(run!.companyId, run!.year, run!.month);
    const baseline = before.rows.find((r) => r.employeeId === employeeId)!;

    const created = await prisma.doubleMachineIncentive.create({
      data: {
        companyId: run!.companyId, employeeId, year: run!.year, month: run!.month,
        doubleMachine: 999, attendanceBonus: 888, shiftIncentive: 777,
        otWeeklyInc: 666, employeeR: 555, status: 'hold',
      },
    });

    try {
      const after = await computeOtIncentiveRegister(run!.companyId, run!.year, run!.month);
      const row = after.rows.find((r) => r.employeeId === employeeId)!;

      // Every module-sourced column pays zero.
      expect(row.doubleMachineIncentive).toBe(0);
      expect(row.attendanceBonus).toBe(0);
      expect(row.shiftIncentive).toBe(0);
      expect(row.otWeeklyIncentive).toBe(0);
      expect(row.employeeReferral).toBe(0);
      expect(row.remarks).toContain('HOLD');
      expect(after.heldRows).toBeGreaterThanOrEqual(1);

      // OT is untouched, and Tot OC Ear is unchanged from the baseline.
      expect(row.otHours).toBe(baseline.otHours);
      expect(row.otAmount).toBe(baseline.otAmount);
      expect(row.otMonthlyIncentive).toBe(baseline.otMonthlyIncentive);
      expect(round2(row.totOcEarnings)).toBe(round2(baseline.totOcEarnings));
    } finally {
      await prisma.doubleMachineIncentive.delete({ where: { id: created.id } });
    }
  }, 120_000);

  it('includes an employee with a Benefits entry but no payroll line, flagged and with no OT', async () => {
    const run = await prisma.payrollRun.findFirst({
      where: { year: 2026, month: 8 },
      select: { id: true, companyId: true, year: true, month: true },
    });
    // Every active employee in this company is already on the run, so the
    // off-run case has to be created rather than found.
    const auth = await getAdminAuth();
    const fixture = await createTestEmployee(auth);
    let created: { id: number } | null = null;

    try {
      const before = await computeOtIncentiveRegister(run!.companyId, run!.year, run!.month);
      expect(before.rows.some((r) => r.employeeId === fixture.id), 'should be absent before').toBe(false);

      created = await prisma.doubleMachineIncentive.create({
        data: {
          companyId: run!.companyId, employeeId: fixture.id, year: run!.year, month: run!.month,
          doubleMachine: 321, attendanceBonus: 0, shiftIncentive: 0,
          otWeeklyInc: 0, employeeR: 0, status: 'process',
        },
      });

      const after = await computeOtIncentiveRegister(run!.companyId, run!.year, run!.month);
      const row = after.rows.find((r) => r.employeeId === fixture.id);
      expect(row, 'off-run employee should now appear').toBeDefined();

      expect(row!.doubleMachineIncentive).toBe(321);
      expect(row!.remarks).toContain('NO PAYROLL LINE');
      expect(after.offRunRows).toBeGreaterThanOrEqual(1);

      // No payroll line means no OT is payable — none may be computed.
      expect(row!.otHours).toBe(0);
      expect(row!.otAmount).toBe(0);
      expect(row!.otMonthlyIncentive).toBe(0);
      expect(row!.otValue).toBeNull();
      expect(row!.otStale, 'no line means nothing to be stale against').toBe(false);

      // Still obeys the workbook formula and reaches the grand total.
      expect(round2(row!.totOcEarnings)).toBe(321);
      expect(round2(after.totals.totOcEarnings)).toBe(round2(before.totals.totOcEarnings + 321));
    } finally {
      if (created) await prisma.doubleMachineIncentive.delete({ where: { id: created.id } });
      await deleteTestEmployee(fixture.id);
    }
  }, 120_000);

  it('returns an empty result rather than throwing when no payroll run exists', async () => {
    const company = await prisma.company.findFirst({ select: { id: true } });
    expect(company).not.toBeNull();
    // A period far enough out that no run can exist.
    const result = await computeOtIncentiveRegister(company!.id, 2099, 12);
    expect(result.run).toBeNull();
    expect(result.rows).toEqual([]);
    expect(result.departmentSummary).toEqual([]);
    expect(result.totals.totOcEarnings).toBe(0);
  });
});
