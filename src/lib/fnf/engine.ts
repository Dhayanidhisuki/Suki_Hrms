import type { FnFFreezeContent, FnFLineDraft } from '@/lib/fnf/types';
import { calculateAnnualTds } from '@/lib/tdsCalculation';
import {
  dailySalary,
  leaveEncashmentAmount,
  netFromLines,
  noticePayAmount,
  noticeShortfallDays,
  prorateComponent,
  remainingAnnualTax,
  round2,
} from '@/lib/fnf/rules';

function pushLine(lines: FnFLineDraft[], line: FnFLineDraft) {
  if (Math.abs(line.amount) < 0.005) return;
  lines.push({ ...line, amount: round2(line.amount) });
}

function noticeBase(freeze: FnFFreezeContent): number {
  const comps = freeze.salaryAsOfLwd.components;
  if (freeze.noticeRateBasis === 'BASIC') {
    return comps.filter((c) => c.code === 'BASIC').reduce((s, c) => s + c.amount, 0) || freeze.salaryAsOfLwd.grossSalary;
  }
  if (freeze.noticeRateBasis === 'BASIC_DA') {
    const v = comps.filter((c) => c.code === 'BASIC' || c.code === 'DA').reduce((s, c) => s + c.amount, 0);
    return v || freeze.salaryAsOfLwd.grossSalary;
  }
  const gross = comps.filter((c) => c.includeInGross && c.type === 'earning').reduce((s, c) => s + c.amount, 0);
  return gross || freeze.salaryAsOfLwd.grossSalary;
}

export async function calculateFnFFromFreeze(freeze: FnFFreezeContent, employeeId: number): Promise<{
  calc: Omit<import('@/lib/fnf/types').FnFCalculation, 'snapshotJson' | 'lines' | 'freezeSnapshotId'> & { lines: FnFLineDraft[] };
  taxableEarnings: number;
}> {
  const lines: FnFLineDraft[] = [];
  const divisor = freeze.salaryDivisor;
  const payableDays = freeze.payableDays;
  const cfg = freeze.config;
  let unpaidSalary = 0;
  let taxableEarnings = 0;

  if (cfg.includeUnpaidSalary) {
    for (const c of freeze.salaryAsOfLwd.components) {
      if (c.type !== 'earning' || !c.fnfPayable) continue;
      const amt = prorateComponent(c.amount, divisor, payableDays, c.fnfProration);
      pushLine(lines, {
        kind: 'EARNING',
        code: `SAL_${c.code}`,
        name: `${c.name} (${payableDays} days)`,
        source: 'SYSTEM',
        amount: amt,
        editable: false,
      });
      unpaidSalary += amt;
      if (c.fnfTaxable) taxableEarnings += amt;
    }
    if (freeze.salaryAsOfLwd.components.length === 0 && freeze.salaryAsOfLwd.grossSalary > 0) {
      const amt = prorateComponent(freeze.salaryAsOfLwd.grossSalary, divisor, payableDays, 'PRO_RATA');
      pushLine(lines, {
        kind: 'EARNING',
        code: 'UNPAID_SALARY',
        name: `Salary payable (${payableDays} days)`,
        source: 'SYSTEM',
        amount: amt,
        editable: false,
      });
      unpaidSalary += amt;
      taxableEarnings += amt;
    }
  }

  let leaveEncashmentDays = 0;
  let leaveEncashment = 0;
  if (cfg.includeLeaveEncashment) {
    const days = freeze.leave.filter((l) => l.encashable).reduce((s, l) => s + Math.max(0, l.closingBalance), 0);
    const basic =
      freeze.salaryAsOfLwd.components.filter((c) => c.code === 'BASIC').reduce((s, c) => s + c.amount, 0) ||
      freeze.salaryAsOfLwd.grossSalary;
    const den = freeze.leaveEncashment.denominator || divisor;
    leaveEncashmentDays = days;
    leaveEncashment = leaveEncashmentAmount(basic, den, days);
    pushLine(lines, {
      kind: 'EARNING',
      code: 'LEAVE_ENCASHMENT',
      name: `Leave encashment (${days} days)`,
      source: 'SYSTEM',
      amount: leaveEncashment,
      editable: false,
      remark: `Basic ÷ ${den} calendar days × EL days`,
    });
    taxableEarnings += leaveEncashment;
  }

  const gratuity = freeze.gratuity;
  if (cfg.includeGratuity && !freeze.gratuityPaidOutside) {
    pushLine(lines, {
      kind: 'EARNING',
      code: 'GRATUITY',
      name: 'Gratuity',
      source: 'SYSTEM',
      amount: gratuity,
      editable: false,
    });
  }

  let bonusProportion = 0;
  if (cfg.includeBonusProportion && freeze.bonus > 0 && !freeze.bonusPaidOutside) {
    bonusProportion = freeze.bonus;
    pushLine(lines, {
      kind: 'EARNING',
      code: 'BONUS',
      name: `Bonus ${freeze.bonusRatePercent ?? 8.33}% of earned basic`,
      source: 'SYSTEM',
      amount: bonusProportion,
      editable: false,
      remark: `Earned basic ${freeze.bonusEarnedBasic}`,
    });
    taxableEarnings += bonusProportion;
  }

  const arrearsAmount = freeze.arrears;
  pushLine(lines, {
    kind: 'EARNING',
    code: 'ARREARS',
    name: 'Pending salary arrears',
    source: 'SYSTEM',
    amount: arrearsAmount,
    editable: false,
  });
  taxableEarnings += arrearsAmount;

  const incentiveAmount = freeze.incentivePaidOutside ? 0 : freeze.incentive;
  if (incentiveAmount > 0) {
    pushLine(lines, {
      kind: 'EARNING',
      code: 'INCENTIVE',
      name: 'Pending incentive / OT bonus',
      source: 'SYSTEM',
      amount: incentiveAmount,
      editable: true,
    });
    taxableEarnings += incentiveAmount;
  }

  const shortfall = noticeShortfallDays(freeze.noticeRequired, freeze.noticeServedDays, freeze.noticeWaivedDays);
  const noticeDaily = dailySalary(noticeBase(freeze), divisor);
  const noticePay = cfg.includeNoticePay
    ? noticePayAmount({ exitType: freeze.exitType, daily: noticeDaily, shortfallDays: shortfall, excessDays: 0 })
    : 0;
  if (noticePay > 0) {
    pushLine(lines, {
      kind: 'EARNING',
      code: 'NOTICE_PAY',
      name: `Notice pay (${shortfall} days)`,
      source: 'SYSTEM',
      amount: noticePay,
      editable: false,
    });
    taxableEarnings += noticePay;
  } else if (noticePay < 0) {
    pushLine(lines, {
      kind: 'DEDUCTION',
      code: 'NOTICE_RECOVERY',
      name: `Notice shortfall recovery (${shortfall} days)`,
      source: 'SYSTEM',
      amount: Math.abs(noticePay),
      editable: false,
    });
  }

  const loanRecovery = cfg.includeLoanRecovery ? freeze.loans.reduce((s, l) => s + l.outstanding, 0) : 0;
  pushLine(lines, {
    kind: 'DEDUCTION',
    code: 'LOAN',
    name: 'Loan recovery',
    source: 'SYSTEM',
    amount: loanRecovery,
    editable: true,
    remark: 'Partial recovery / waiver requires a remark on override',
  });

  const assetRecovery = cfg.includeAssetRecovery ? freeze.assets.reduce((s, a) => s + a.value, 0) : 0;
  pushLine(lines, {
    kind: 'DEDUCTION',
    code: 'ASSET',
    name: 'Unreturned asset recovery',
    source: 'SYSTEM',
    amount: assetRecovery,
    editable: true,
  });

  const ratio = divisor > 0 ? payableDays / divisor : 0;
  let pfDeduction = 0;
  let esiDeduction = 0;
  let ptDeduction = 0;
  if (freeze.lastPayroll && payableDays > 0 && unpaidSalary > 0) {
    if (cfg.includePf) {
      pfDeduction = round2(freeze.lastPayroll.pf * ratio);
      pushLine(lines, {
        kind: 'DEDUCTION',
        code: 'PF',
        name: 'PF (employee, pro-rata last locked run)',
        source: 'SYSTEM',
        amount: pfDeduction,
        editable: false,
      });
    }
    if (cfg.includeEsi) {
      esiDeduction = round2(freeze.lastPayroll.esi * ratio);
      pushLine(lines, {
        kind: 'DEDUCTION',
        code: 'ESI',
        name: 'ESI (employee, pro-rata last locked run)',
        source: 'SYSTEM',
        amount: esiDeduction,
        editable: false,
      });
    }
    if (cfg.includePt) {
      const pt = round2(freeze.lastPayroll.pt * ratio);
      ptDeduction = pt;
      pushLine(lines, {
        kind: 'DEDUCTION',
        code: 'PT',
        name: 'Professional tax (pro-rata)',
        source: 'SYSTEM',
        amount: pt,
        editable: false,
      });
    }
  }

  let tdsDeduction = 0;
  if (cfg.includeTds) {
    const annual = await calculateAnnualTds(
      employeeId,
      freeze.tdsYtd.financialYear,
      freeze.tdsYtd.grossYtd + taxableEarnings,
      freeze.tdsYtd.tdsYtd,
      0,
    );
    tdsDeduction = remainingAnnualTax(annual.annualTax, freeze.tdsYtd.tdsYtd);
    pushLine(lines, {
      kind: 'DEDUCTION',
      code: 'TDS',
      name: 'Remaining annual TDS',
      source: 'SYSTEM',
      amount: tdsDeduction,
      editable: true,
      remark: `Annual tax ${annual.annualTax} − YTD ${freeze.tdsYtd.tdsYtd}`,
    });
  }

  const totals = netFromLines(lines);
  return {
    taxableEarnings,
    calc: {
      unpaidSalary: round2(unpaidSalary),
      leaveEncashment,
      leaveEncashmentDays,
      gratuity,
      bonusProportion,
      noticePay,
      loanRecovery: round2(loanRecovery),
      assetRecovery: round2(assetRecovery),
      otherPayments: 0,
      otherDeductions: 0,
      arrearsAmount: round2(arrearsAmount),
      incentiveAmount: round2(incentiveAmount),
      tdsDeduction,
      pfDeduction,
      esiDeduction,
      ptDeduction,
      payableDays,
      salaryDivisor: divisor,
      noticeServedDays: freeze.noticeServedDays,
      noticeWaivedDays: freeze.noticeWaivedDays,
      noticeShortfallDays: shortfall,
      totalPayable: totals.totalPayable,
      totalRecovery: totals.totalRecovery,
      netPayable: totals.netPayable,
      lines,
    },
  };
}
