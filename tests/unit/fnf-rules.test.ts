import { describe, it, expect } from 'vitest';
import {
  attendanceUnits,
  bonusOnEarnedBasic,
  dailySalary,
  earnedBasic,
  gratuityCalculationYears,
  isClearanceCleared,
  leaveEncashmentAmount,
  netFromLines,
  noticePayAmount,
  noticeShortfallDays,
  pickSalaryRevisionAsOf,
  prorateComponent,
  remainingAnnualTax,
  round2,
  salaryPayable,
  unpaidPayableDays,
} from '@/lib/fnf/rules';

describe('F&F BRD formulas', () => {
  it('computes daily salary from monthly / divisor', () => {
    expect(dailySalary(30000, 30)).toBe(1000);
    expect(salaryPayable(30000, 30, 15)).toBe(15000);
  });

  it('counts unpaid days after last payroll month', () => {
    const lwd = new Date(Date.UTC(2026, 8, 15)); // 15 Sep 2026
    expect(unpaidPayableDays(lwd, { year: 2026, month: 8 })).toBe(15);
    expect(unpaidPayableDays(lwd, { year: 2026, month: 9 })).toBe(0);
    expect(unpaidPayableDays(lwd, null)).toBe(15);
  });

  it('applies notice waiver to shortfall recovery on resignation', () => {
    expect(noticeShortfallDays(30, 10, 5)).toBe(15);
    expect(noticePayAmount({ exitType: 'resignation', daily: 1000, shortfallDays: 15, excessDays: 0 })).toBe(-15000);
  });

  it('pays remaining notice on termination', () => {
    expect(noticePayAmount({ exitType: 'termination', daily: 1000, shortfallDays: 20, excessDays: 0 })).toBe(20000);
  });

  it('nets earnings minus deductions', () => {
    expect(
      netFromLines([
        { kind: 'EARNING', amount: 15000 },
        { kind: 'DEDUCTION', amount: 4000 },
      ]),
    ).toEqual({ totalPayable: 15000, totalRecovery: 4000, netPayable: 11000 });
  });

  it('picks salary revision as of last working date (BR-FNF-003)', () => {
    const lwd = new Date(Date.UTC(2026, 8, 15));
    const older = { id: 1, effectiveFrom: new Date(Date.UTC(2026, 0, 1)), effectiveTo: new Date(Date.UTC(2026, 7, 31)) };
    const asOf = { id: 2, effectiveFrom: new Date(Date.UTC(2026, 8, 1)), effectiveTo: null };
    const later = { id: 3, effectiveFrom: new Date(Date.UTC(2026, 9, 1)), effectiveTo: null };
    expect(pickSalaryRevisionAsOf([older, asOf, later], lwd)?.id).toBe(2);
  });

  it('pro-rates, keeps full, or excludes a component (FR-FNF-002)', () => {
    expect(prorateComponent(30000, 30, 10, 'PRO_RATA')).toBe(10000);
    expect(prorateComponent(30000, 30, 10, 'FULL')).toBe(30000);
    expect(prorateComponent(30000, 30, 10, 'EXCLUDE')).toBe(0);
  });

  it('counts attendance units including LOP and half-day', () => {
    expect(attendanceUnits('Present')).toBe(1);
    expect(attendanceUnits('HalfDay')).toBe(0.5);
    expect(attendanceUnits('Absent')).toBe(0);
    expect(attendanceUnits('Leave')).toBe(1);
  });

  it('computes remaining annual TDS, not last-month pro-rata (BR-FNF-005)', () => {
    expect(remainingAnnualTax(120000, 100000)).toBe(20000);
    expect(remainingAnnualTax(50000, 60000)).toBe(0);
  });

  it('requires all clearance checks (FR-FNF-001 gate)', () => {
    expect(
      isClearanceCleared(
        [
          { checkCode: 'MANAGER', status: 'CLEARED' },
          { checkCode: 'IT', status: 'PENDING' },
          { checkCode: 'FINANCE', status: 'CLEARED' },
          { checkCode: 'HR', status: 'CLEARED' },
        ],
        'PENDING',
      ),
    ).toBe(false);
    expect(
      isClearanceCleared(
        [
          { checkCode: 'MANAGER', status: 'CLEARED' },
          { checkCode: 'IT', status: 'CLEARED' },
          { checkCode: 'FINANCE', status: 'CLEARED' },
          { checkCode: 'HR', status: 'CLEARED' },
        ],
        'PENDING',
      ),
    ).toBe(true);
  });

  it('matches KUN leave, bonus 8.33% of earned basic, and gratuity year rounding', () => {
    expect(leaveEncashmentAmount(24834, 31, 148)).toBe(118562.32);
    expect(earnedBasic(24834, 30, 31)).toBe(24032.9);
    expect(bonusOnEarnedBasic(247539, 8.33)).toBe(20620);
    expect(
      gratuityCalculationYears(new Date(Date.UTC(2012, 4, 1)), new Date(Date.UTC(2026, 0, 30))),
    ).toBe(14);
    expect(round2((24833.6 / 26) * 15 * 14)).toBe(200579.08);
  });
});
