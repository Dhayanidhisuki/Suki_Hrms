import { describe, it, expect, vi } from 'vitest';
import { calculateFnFFromFreeze } from '@/lib/fnf/engine';
import type { FnFFreezeContent } from '@/lib/fnf/types';

vi.mock('@/lib/tdsCalculation', () => ({
  calculateAnnualTds: async () => ({ annualTax: 12000 }),
}));

function freeze(over: Partial<FnFFreezeContent> = {}): FnFFreezeContent {
  return {
    frozenAt: '2026-09-16T00:00:00.000Z',
    employeeId: 459,
    exitInterviewId: 99,
    lastWorkingDay: '2026-10-10T00:00:00.000Z',
    exitType: 'resignation',
    noticeRequired: 30,
    noticeServedDays: 20,
    noticeWaivedDays: 0,
    salaryDivisor: 30,
    salaryDivisorMode: 'DAYS_30',
    noticeRateBasis: 'BASIC',
    periodStart: '2026-10-01T00:00:00.000Z',
    lastPayroll: {
      year: 2026,
      month: 9,
      gross: 50000,
      tds: 2000,
      pf: 1800,
      esi: 375,
      pt: 200,
      status: 'LOCKED',
    },
    salaryAsOfLwd: {
      revisionId: 1,
      grossSalary: 50000,
      components: [
        {
          salaryComponentId: 1,
          code: 'BASIC',
          name: 'Basic',
          type: 'earning',
          amount: 30000,
          includeInGross: true,
          includeInPf: true,
          fnfPayable: true,
          fnfProration: 'PRO_RATA',
          fnfTaxable: true,
        },
        {
          salaryComponentId: 2,
          code: 'HRA',
          name: 'HRA',
          type: 'earning',
          amount: 20000,
          includeInGross: true,
          includeInPf: false,
          fnfPayable: true,
          fnfProration: 'PRO_RATA',
          fnfTaxable: true,
        },
      ],
    },
    attendanceDays: [],
    payableDays: 10,
    leave: [{ typeCode: 'EL', closingBalance: 5, encashable: true }],
    leaveEncashment: { denominator: 30, basis: 'BASIC', maxDays: 30, includeEarnedOnly: false },
    gratuity: 100000,
    gratuityPaidOutside: false,
    bonus: 0,
    bonusPaidOutside: false,
    bonusRatePercent: 8.33,
    bonusEarnedBasic: 0,
    arrears: 1500,
    incentive: 0,
    incentivePaidOutside: true,
    loans: [{ id: 1, outstanding: 4000 }],
    assets: [{ id: 1, value: 500 }],
    tdsYtd: { financialYear: 2026, grossYtd: 400000, tdsYtd: 8000 },
    config: {
      includeUnpaidSalary: true,
      includeLeaveEncashment: true,
      includeGratuity: true,
      includeBonusProportion: false,
      includeNoticePay: true,
      includeLoanRecovery: true,
      includeAssetRecovery: true,
      includeTds: true,
      includePf: true,
      includeEsi: true,
      includePt: true,
      clearanceRequired: true,
    },
    ...over,
  };
}

describe('calculateFnFFromFreeze', () => {
  it('builds lines from LWD salary, leave, notice, loans, assets, arrears, remaining TDS', async () => {
    const { calc } = await calculateFnFFromFreeze(freeze(), 459);
    const byCode = Object.fromEntries(calc.lines.map((l) => [l.code, l]));
    expect(byCode.SAL_BASIC.amount).toBe(10000);
    expect(byCode.SAL_HRA.amount).toBe(6666.67);
    expect(byCode.LEAVE_ENCASHMENT.amount).toBe(5000);
    expect(byCode.GRATUITY.amount).toBe(100000);
    expect(byCode.ARREARS.amount).toBe(1500);
    expect(byCode.NOTICE_RECOVERY.kind).toBe('DEDUCTION');
    expect(byCode.NOTICE_RECOVERY.amount).toBe(10000);
    expect(byCode.LOAN.amount).toBe(4000);
    expect(byCode.ASSET.amount).toBe(500);
    expect(byCode.TDS.amount).toBe(4000);
    expect(calc.netPayable).toBe(calc.totalPayable - calc.totalRecovery);
  });

  it('matches KUN leave (Basic/calendar days × EL) and excludes paid-outside gratuity/incentive', async () => {
    const { calc } = await calculateFnFFromFreeze(
      freeze({
        payableDays: 0,
        leave: [{ typeCode: 'EL', closingBalance: 148, encashable: true }],
        leaveEncashment: { denominator: 31, basis: 'BASIC', maxDays: null, includeEarnedOnly: true },
        salaryAsOfLwd: {
          revisionId: 1,
          grossSalary: 59529,
          components: [
            {
              salaryComponentId: 1,
              code: 'BASIC',
              name: 'Basic',
              type: 'earning',
              amount: 24834,
              includeInGross: true,
              includeInPf: true,
              fnfPayable: true,
              fnfProration: 'PRO_RATA',
              fnfTaxable: true,
            },
          ],
        },
        gratuity: 200579,
        gratuityPaidOutside: true,
        bonus: 20620,
        bonusPaidOutside: false,
        bonusRatePercent: 8.33,
        bonusEarnedBasic: 247539,
        incentive: 2647,
        incentivePaidOutside: true,
        loans: [],
        assets: [],
        arrears: 0,
        noticeRequired: 0,
        noticeServedDays: 0,
        config: {
          includeUnpaidSalary: true,
          includeLeaveEncashment: true,
          includeGratuity: true,
          includeBonusProportion: true,
          includeNoticePay: true,
          includeLoanRecovery: true,
          includeAssetRecovery: true,
          includeTds: false,
          includePf: true,
          includeEsi: true,
          includePt: true,
          clearanceRequired: true,
        },
      }),
      37,
    );
    const byCode = Object.fromEntries(calc.lines.map((l) => [l.code, l]));
    expect(byCode.LEAVE_ENCASHMENT.amount).toBe(118562.32);
    expect(byCode.BONUS.amount).toBe(20620);
    expect(byCode.GRATUITY).toBeUndefined();
    expect(byCode.INCENTIVE).toBeUndefined();
    expect(byCode.SAL_BASIC).toBeUndefined();
    expect(calc.netPayable).toBe(139182.32);
  });
});
