/**
 * The payslip's "Other Earnings" residual.
 *
 * This row was silently never rendered: PayslipView read four properties
 * (attendanceBonus, petrolAllowance, doubleMachineIncentive, shiftIncentive)
 * that do not exist on PayrollLine, so `Number(undefined)` made the residual
 * NaN and `NaN > 0` hid the row. Those four are PayrollLineComponent rows and
 * are already listed by name, so they were removed rather than re-sourced.
 *
 * The residual must leave the itemised earnings summing exactly to
 * Total Earnings (grossEarnings + otherEarningsTotal).
 */

import { describe, it, expect } from 'vitest';
import {
  computeOtherAutoDeductions,
  computeOtherAutoEarnings,
  displayableDeductionComponents,
  displayableEarningComponents,
} from '@/components/payroll/PayslipView';

const line = (o: Partial<Record<'grossEarnings' | 'otherEarningsTotal' | 'otAmount' | 'otIncentiveAmount' | 'performanceIncentive', number>>) => ({
  grossEarnings: String(o.grossEarnings ?? 0),
  otherEarningsTotal: String(o.otherEarningsTotal ?? 0),
  otAmount: String(o.otAmount ?? 0),
  otIncentiveAmount: String(o.otIncentiveAmount ?? 0),
  performanceIncentive: String(o.performanceIncentive ?? 0),
});

describe('computeOtherAutoEarnings', () => {
  it('is zero when every auto earning is already itemised (EMP034, July 2026)', () => {
    // Real data, payroll line 89: gross 25,000 = Basic 15,000 + HRA 7,000 +
    // Conv 3,000. otherEarningsTotal 4,701 = OT 3,201 + Night Allowance 1,500.
    // Night Allowance has its own component row, so nothing is left over.
    const components = [
      { amount: '15000' }, { amount: '7000' }, { amount: '3000' }, { amount: '1500' },
    ];
    const l = line({ grossEarnings: 25000, otherEarningsTotal: 4701, otAmount: 3201 });
    expect(computeOtherAutoEarnings(l, components)).toBe(0);

    // The displayed rows must tie to Total Earnings exactly.
    const listed = 15000 + 7000 + 3000 + 1500 + 3201;
    expect(listed).toBe(Number(l.grossEarnings) + Number(l.otherEarningsTotal));
  });

  it('does not double-count a component flagged includeInGross that payroll put outside gross', () => {
    // NIGHT_ALLOWANCE is includeInGross = true yet lands in otherEarningsTotal,
    // which is why the residual is derived from stored totals, not flags.
    const l = line({ grossEarnings: 25000, otherEarningsTotal: 1500 });
    expect(computeOtherAutoEarnings(l, [{ amount: '25000' }, { amount: '1500' }])).toBe(0);
  });

  it('surfaces an auto earning that produced no component row', () => {
    // e.g. payroll credited a 900 double-machine incentive but the
    // DM_INCENTIVE SalaryComponent master is missing, so no row was written.
    const l = line({ grossEarnings: 25000, otherEarningsTotal: 900 });
    expect(computeOtherAutoEarnings(l, [{ amount: '25000' }])).toBe(900);
  });

  it('subtracts the three real PayrollLine earning columns', () => {
    const l = line({ grossEarnings: 10000, otherEarningsTotal: 5000, otAmount: 2000, otIncentiveAmount: 500, performanceIncentive: 1000 });
    expect(computeOtherAutoEarnings(l, [{ amount: '10000' }])).toBe(1500);
  });

  it('never returns NaN when there are no components', () => {
    const result = computeOtherAutoEarnings(line({ grossEarnings: 10000, otherEarningsTotal: 0 }), []);
    expect(Number.isNaN(result)).toBe(false);
    expect(result).toBe(0);
  });
});

/**
 * Deduction-side twin. otherDeductionsTotal = recurring + ad-hoc + auto, and
 * every recurring deduction component is ALSO written as a
 * PayrollLineComponent, so subtracting only the column-backed auto deductions
 * left those components counted twice.
 */
describe('computeOtherAutoDeductions', () => {
  const dline = (o: Partial<Record<'otherDeductionsTotal' | 'lomAmount' | 'lwfAmount' | 'healthInsurance' | 'licAmount', number>>) => ({
    otherDeductionsTotal: String(o.otherDeductionsTotal ?? 0),
    lomAmount: String(o.lomAmount ?? 0),
    lwfAmount: String(o.lwfAmount ?? 0),
    healthInsurance: String(o.healthInsurance ?? 0),
    licAmount: String(o.licAmount ?? 0),
  });

  it('excludes a recurring deduction component already listed by name (line 203, DED-2 Medical)', () => {
    // Real data: otherDeductionsTotal 2,500 includes the 500 "Medical"
    // component, which the payslip also lists by name.
    const l = dline({ otherDeductionsTotal: 2500 });
    expect(computeOtherAutoDeductions(l, [{ amount: '500' }])).toBe(2000);

    // Listed rows must tie to Total Deductions (pfEmployee 2,160 + 2,500).
    const listed = 2160 /* PF */ + 500 /* Medical */ + 2000 /* residual */;
    expect(listed).toBe(2160 + 2500);
  });

  it('subtracts the four column-backed auto deductions (line 82)', () => {
    // otherDeductionsTotal 2,042 with LOM 1,550 and no displayed components.
    const l = dline({ otherDeductionsTotal: 2042, lomAmount: 1550 });
    expect(computeOtherAutoDeductions(l, [])).toBe(492);
    expect(2952 /* PF */ + 1550 /* LOM */ + 492).toBe(2952 + 2042);
  });

  it('is unchanged when there are no deduction components to list', () => {
    expect(computeOtherAutoDeductions(dline({ otherDeductionsTotal: 2000 }), [])).toBe(2000);
  });

  it('goes to zero when components account for the whole remainder', () => {
    const l = dline({ otherDeductionsTotal: 1500, lwfAmount: 200, licAmount: 300 });
    expect(computeOtherAutoDeductions(l, [{ amount: '1000' }])).toBe(0);
  });

  it('never returns NaN with an empty line', () => {
    const r = computeOtherAutoDeductions(dline({}), []);
    expect(Number.isNaN(r)).toBe(false);
    expect(r).toBe(0);
  });
});

/**
 * Column mirrors. Several figures reach the payslip twice — as a PayrollLine
 * column with its own hardcoded row, and as a PayrollLineComponent payroll
 * also writes when the SalaryComponent exists. Nothing arbitrated, so a
 * company that had the component saw the money on two lines and the itemised
 * earnings overstated Total Earnings. The column wins; the mirror is dropped.
 */
describe('column-mirrored components', () => {
  const comp = (code: string, type: string, amount = '100') => ({ amount, salaryComponent: { code, type } });

  it('drops an earning component that mirrors a PayrollLine column', () => {
    const rows = [comp('BASIC', 'earning'), comp('OT_PAY', 'earning'), comp('PERFORMANCE_INS', 'earning'), comp('OT_INCENTIVE', 'earning')];
    expect(displayableEarningComponents(rows).map((c) => c.salaryComponent.code)).toEqual(['BASIC']);
  });

  it('drops PF and ESI, which the pfEmployee/esiEmployee columns already show', () => {
    const rows = [comp('PF', 'deduction'), comp('ESI', 'deduction'), comp('DED-2', 'deduction')];
    expect(displayableDeductionComponents(rows).map((c) => c.salaryComponent.code)).toEqual(['DED-2']);
  });

  it('no longer hides ARREAR_PF / ARREAR_ESI, which the old substring match caught', () => {
    // The previous filter tested `code.includes('pf') || name.includes('pf')`,
    // so a legitimate PF-arrear deduction was silently omitted from the payslip.
    const rows = [comp('ARREAR_PF', 'deduction'), comp('ARREAR_ESI', 'deduction')];
    expect(displayableDeductionComponents(rows).map((c) => c.salaryComponent.code))
      .toEqual(['ARREAR_PF', 'ARREAR_ESI']);
  });

  it('keeps the residual correct when a mirror exists', () => {
    // gross 10,000; otherEarningsTotal 3,000 = OT 2,000 + a 1,000 incentive
    // component. An OT_PAY mirror of 2,000 is also present.
    const all = [comp('BASIC', 'earning', '10000'), comp('DM_INCENTIVE', 'earning', '1000'), comp('OT_PAY', 'earning', '2000')];
    const displayed = displayableEarningComponents(all);
    const l = {
      grossEarnings: '10000', otherEarningsTotal: '3000',
      otAmount: '2000', otIncentiveAmount: '0', performanceIncentive: '0',
    };
    // Displayed components beyond gross = the 1,000 incentive. Residual is 0:
    // 3,000 − 2,000 (OT column) − 1,000 (incentive component) = 0.
    expect(computeOtherAutoEarnings(l, displayed)).toBe(0);
    // Passing the unfiltered list would double-subtract the OT mirror.
    expect(computeOtherAutoEarnings(l, all)).toBe(-2000);
  });

  it('leaves a payslip with no mirrors completely unchanged', () => {
    const rows = [comp('BASIC', 'earning'), comp('HRA', 'earning'), comp('DED-2', 'deduction')];
    expect(displayableEarningComponents(rows)).toHaveLength(2);
    expect(displayableDeductionComponents(rows)).toHaveLength(1);
  });
});
