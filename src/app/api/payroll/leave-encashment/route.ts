/**
 * GET /api/payroll/leave-encashment?employeeId=X&days=Y
 *
 * Calculates leave encashment for an employee based on the company's
 * LeaveEncashmentConfig. Returns the encashable days, per-day salary,
 * and total encashment amount.
 *
 * If days is not given, uses all available encashable leave balance
 * (capped by maxEncashableDays).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const requestedDays = searchParams.get('days');

  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
  }

  const empId = Number(employeeId);

  const [config, leaveBalances, lastPayrollLine] = await Promise.all([
    prisma.leaveEncashmentConfig.findUnique({ where: { companyId: scope.companyId } }),
    prisma.leaveBalance.findMany({
      where: { employeeId: empId, leaveMaster: { isActive: true, deletedAt: null } },
      include: { leaveMaster: true },
    }),
    prisma.payrollLine.findFirst({
      where: { employeeId: empId },
      orderBy: { payrollRun: { year: 'desc' } },
      include: {
        payrollRun: true,
        components: { include: { salaryComponent: true } },
      },
    }),
  ]);

  if (!config) {
    return NextResponse.json({ error: 'Leave encashment config not set up' }, { status: 400 });
  }

  // Determine encashable balances.
  const encashableBalances = config.includeEarnedOnly
    ? leaveBalances.filter((b) => b.leaveMaster?.code === 'EL' || b.leaveMaster?.code === 'PL')
    : leaveBalances;
  const totalAvailableDays = encashableBalances.reduce((sum, b) => sum + Number(b.closingBalance), 0);
  const encashDays = requestedDays
    ? Math.min(Number(requestedDays), totalAvailableDays, config.maxEncashableDays ?? totalAvailableDays)
    : Math.min(totalAvailableDays, config.maxEncashableDays ?? totalAvailableDays);

  // Compute per-day salary based on configured basis.
  let perDaySalary = 0;
  let basisDetail = '';
  const denominator = config.denominator ?? 26;

  if (lastPayrollLine) {
    if (config.calculationBasis === 'GROSS') {
      perDaySalary = Number(lastPayrollLine.grossEarnings) / denominator;
      basisDetail = `Gross (${Number(lastPayrollLine.grossEarnings).toFixed(2)} / ${denominator})`;
    } else if (config.calculationBasis === 'BASIC') {
      const basicComp = lastPayrollLine.components.find((c) => c.salaryComponent.code === 'BASIC');
      if (basicComp) {
        perDaySalary = Number(basicComp.amount) / denominator;
        basisDetail = `Basic (${Number(basicComp.amount).toFixed(2)} / ${denominator})`;
      }
    } else if (config.calculationBasis === 'BASIC_DA') {
      const basicDa = lastPayrollLine.components.filter((c) =>
        c.salaryComponent.code === 'BASIC' || c.salaryComponent.code === 'DA'
      );
      const total = basicDa.reduce((s, c) => s + Number(c.amount), 0);
      perDaySalary = total / denominator;
      basisDetail = `Basic+DA (${total.toFixed(2)} / ${denominator})`;
    }
  }

  const encashmentAmount = Number((perDaySalary * encashDays).toFixed(2));

  return NextResponse.json({
    employeeId: empId,
    calculationBasis: config.calculationBasis,
    denominator,
    basisDetail,
    perDaySalary: Number(perDaySalary.toFixed(2)),
    totalAvailableDays,
    maxEncashableDays: config.maxEncashableDays,
    encashDays,
    encashmentAmount,
    leaveBreakdown: encashableBalances.map((b) => ({
      leaveType: b.leaveMaster?.code ?? 'UNKNOWN',
      leaveName: b.leaveMaster?.name ?? 'Unknown',
      balance: Number(b.closingBalance),
    })),
  });
}
