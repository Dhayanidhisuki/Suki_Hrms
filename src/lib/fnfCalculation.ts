/**
 * Full & Final settlement calculation.
 *
 * Aggregates all terminal dues for an exiting employee based on the
 * company's FullAndFinalConfig:
 *   - Unpaid salary (salary for days worked but not yet paid)
 *   - Leave encashment (based on LeaveEncashmentConfig)
 *   - Gratuity (from existing GratuityRecord if eligible)
 *   - Bonus proportion (if configured)
 *   - Notice pay (payable or recovery)
 *   - Loan recovery (outstanding loan balances)
 *   - Asset recovery (manual entry)
 *
 * The calculation reads existing data (gratuity records, loan balances,
 * leave balances) and produces a settlement record.
 */

import { prisma } from '@/lib/prisma';

export interface FnFCalculation {
  unpaidSalary: number;
  leaveEncashment: number;
  leaveEncashmentDays: number;
  gratuity: number;
  bonusProportion: number;
  noticePay: number;
  loanRecovery: number;
  assetRecovery: number;
  otherPayments: number;
  otherDeductions: number;
  totalPayable: number;
  totalRecovery: number;
  netPayable: number;
}

/**
 * Calculate the FnF settlement for an employee based on their exit
 * interview and the company's FnF config.
 */
export async function calculateFnF(
  employeeId: number,
  exitInterviewId: number,
  companyId: number
): Promise<FnFCalculation> {
  const [config, employee, exitInterview, gratuityRecord, leaveEncashmentConfig] = await Promise.all([
    prisma.fullAndFinalConfig.findUnique({ where: { companyId } }),
    prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        jobInfos: {
          where: { effectiveTo: null },
          take: 1,
          include: { designation: true, department: true },
        },
      },
    }),
    prisma.exitInterview.findUnique({ where: { id: exitInterviewId } }),
    prisma.gratuityRecord.findFirst({
      where: { employeeId, status: { in: ['CALCULATED', 'APPROVED', 'PAID'] } },
    }),
    prisma.leaveEncashmentConfig.findUnique({ where: { companyId } }),
  ]);

  if (!employee) throw new Error(`Employee ${employeeId} not found`);
  if (!exitInterview) throw new Error(`ExitInterview ${exitInterviewId} not found`);

  const lastWorkingDay = exitInterview.exitDate;
  const result: FnFCalculation = {
    unpaidSalary: 0,
    leaveEncashment: 0,
    leaveEncashmentDays: 0,
    gratuity: 0,
    bonusProportion: 0,
    noticePay: 0,
    loanRecovery: 0,
    assetRecovery: 0,
    otherPayments: 0,
    otherDeductions: 0,
    totalPayable: 0,
    totalRecovery: 0,
    netPayable: 0,
  };

  // 1. Unpaid salary — salary for days from last payroll cycle to lastWorkingDay.
  //    Approximation: find the last payroll line and compute per-day salary.
  if (config?.includeUnpaidSalary) {
    const lastPayrollLine = await prisma.payrollLine.findFirst({
      where: { employeeId },
      include: { payrollRun: true },
      orderBy: { payrollRun: { year: 'desc' } },
    });
    if (lastPayrollLine) {
      const runDate = new Date(Date.UTC(lastPayrollLine.payrollRun.year, lastPayrollLine.payrollRun.month - 1, 1));
      const daysInLastMonth = new Date(runDate.getUTCFullYear(), runDate.getUTCMonth() + 1, 0).getUTCDate();
      const dailySalary = Number(lastPayrollLine.grossEarnings) / daysInLastMonth;
      // Days from end of last payroll month to lastWorkingDay.
      const lastPayrollEnd = new Date(runDate.getUTCFullYear(), runDate.getUTCMonth() + 1, 0);
      const unpaidDays = Math.max(0, Math.ceil((lastWorkingDay.getTime() - lastPayrollEnd.getTime()) / (1000 * 60 * 60 * 24)));
      result.unpaidSalary = Number((dailySalary * unpaidDays).toFixed(2));
    }
  }

  // 2. Leave encashment — based on LeaveEncashmentConfig.
  if (config?.includeLeaveEncashment && leaveEncashmentConfig) {
    const leaveBalances = await prisma.leaveBalance.findMany({
      where: { employeeId },
      include: { leaveMaster: true },
    });
    const encashableBalances = leaveEncashmentConfig.includeEarnedOnly
      ? leaveBalances.filter((b) => b.leaveMaster?.code === 'EL' || b.leaveMaster?.code === 'PL')
      : leaveBalances;
    const totalEncashableDays = encashableBalances.reduce((sum, b) => sum + Number(b.closingBalance), 0);
    const cappedDays = Math.min(totalEncashableDays, leaveEncashmentConfig.maxEncashableDays ?? totalEncashableDays);

    // Compute per-day salary based on configured basis.
    const lastPayrollLine = await prisma.payrollLine.findFirst({
      where: { employeeId },
      orderBy: { payrollRun: { year: 'desc' } },
      include: { payrollRun: true },
    });
    if (lastPayrollLine) {
      let perDaySalary = 0;
      const denominator = leaveEncashmentConfig.denominator ?? 26;
      if (leaveEncashmentConfig.calculationBasis === 'GROSS') {
        perDaySalary = Number(lastPayrollLine.grossEarnings) / denominator;
      } else if (leaveEncashmentConfig.calculationBasis === 'BASIC') {
        const basicComp = await prisma.payrollLineComponent.findFirst({
          where: {
            payrollLineId: lastPayrollLine.id,
            salaryComponent: { code: 'BASIC' },
          },
        });
        perDaySalary = basicComp ? Number(basicComp.amount) / denominator : 0;
      } else if (leaveEncashmentConfig.calculationBasis === 'BASIC_DA') {
        const basicDa = await prisma.payrollLineComponent.findMany({
          where: {
            payrollLineId: lastPayrollLine.id,
            salaryComponent: { code: { in: ['BASIC', 'DA'] } },
          },
        });
        const total = basicDa.reduce((s, c) => s + Number(c.amount), 0);
        perDaySalary = total / denominator;
      }
      result.leaveEncashmentDays = cappedDays;
      result.leaveEncashment = Number((perDaySalary * cappedDays).toFixed(2));
    }
  }

  // 3. Gratuity — from existing GratuityRecord.
  if (config?.includeGratuity && gratuityRecord) {
    result.gratuity = Number(gratuityRecord.payableGratuity ?? gratuityRecord.grossGratuity ?? 0);
  }

  // 4. Bonus proportion — deferred (requires bonus policy integration).
  if (config?.includeBonusProportion) {
    result.bonusProportion = 0; // Placeholder — requires bonus policy
  }

  // 5. Notice pay — payable if employee served less than notice period,
  //    recovery if employee didn't serve notice period.
  if (config?.includeNoticePay) {
    const noticeDays = config.noticePeriodDays ?? 30;
    const doj = employee.jobInfos[0]?.joinDate ?? new Date(0);
    // Simplified: if employee served full notice, no notice pay.
    // If not, notice pay = daily salary × (noticeDays - daysServedInNotice).
    // For now, default to 0 — needs actual notice period tracking.
    void doj; void noticeDays;
    result.noticePay = 0;
  }

  // 6. Loan recovery — sum of outstanding loan balances.
  if (config?.includeLoanRecovery) {
    const activeLoans = await prisma.loan.findMany({
      where: { employeeId, status: { in: ['active', 'approved'] } },
    });
    result.loanRecovery = activeLoans.reduce((sum, l) => sum + Number(l.outstandingBalance), 0);
  }

  // 7. Asset recovery — manual, default 0.
  result.assetRecovery = 0;

  // Compute totals.
  result.totalPayable = result.unpaidSalary + result.leaveEncashment + result.gratuity +
    result.bonusProportion + Math.max(0, result.noticePay) + result.otherPayments;
  result.totalRecovery = result.loanRecovery + result.assetRecovery +
    Math.max(0, -result.noticePay) + result.otherDeductions;
  result.netPayable = Number((result.totalPayable - result.totalRecovery).toFixed(2));

  return result;
}
