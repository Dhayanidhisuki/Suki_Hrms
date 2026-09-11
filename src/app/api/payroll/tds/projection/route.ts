/**
 * GET /api/payroll/tds/projection?employeeId=X&financialYear=YYYY
 *
 * Returns a month-by-month TDS projection for the financial year,
 * showing actual deducted TDS (from payroll lines) and projected TDS
 * for remaining months based on the annual calculation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { calculateAnnualTds } from '@/lib/tdsCalculation';

const MONTH_NAMES = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const financialYear = parseInt(searchParams.get('financialYear') ?? String(new Date().getUTCFullYear()));

  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
  }

  const empId = Number(employeeId);

  const config = await prisma.tdsRegimeConfig.findUnique({ where: { companyId: scope.companyId } });
  const fyStartMonth = config?.financialYearStart ?? 4;

  // Load all payroll lines for this employee in the FY.
  const lines = await prisma.payrollLine.findMany({
    where: {
      employeeId: empId,
      payrollRun: { companyId: scope.companyId },
    },
    include: { payrollRun: { select: { year: true, month: true, status: true } } },
  });

  // Build month-by-month actuals.
  const monthlyActuals: Array<{ month: string; year: number; gross: number; tds: number; status: string }> = [];
  let grossYTD = 0;
  let tdsYTD = 0;
  let monthsProcessed = 0;

  for (let i = 0; i < 12; i++) {
    const calMonth = ((fyStartMonth - 1 + i) % 12) + 1; // 1-12
    const calYear = fyStartMonth - 1 + i < 12 ? financialYear : financialYear + 1;
    const line = lines.find((l) => l.payrollRun.year === calYear && l.payrollRun.month === calMonth);
    const gross = line ? Number(line.grossEarnings) : 0;
    const tds = line ? Number(line.tds) : 0;
    const status = line?.payrollRun.status ?? 'NOT_RUN';
    if (line) {
      grossYTD += gross;
      tdsYTD += tds;
      monthsProcessed++;
    }
    monthlyActuals.push({
      month: MONTH_NAMES[i],
      year: calYear,
      gross,
      tds,
      status,
    });
  }

  const remainingMonths = Math.max(0, 12 - monthsProcessed);
  const annualCalc = await calculateAnnualTds(empId, financialYear, grossYTD, tdsYTD, remainingMonths);

  // Projected TDS for remaining months = remainingTDS spread evenly.
  const projectedMonthlyTDS = remainingMonths > 0 ? annualCalc.remainingTDS : 0;

  return NextResponse.json({
    employeeId: empId,
    financialYear,
    fyStartMonth,
    monthlyActuals,
    annualCalc,
    projectedMonthlyTDS: Number(projectedMonthlyTDS.toFixed(2)),
    summary: {
      grossYTD: Number(grossYTD.toFixed(2)),
      tdsYTD: Number(tdsYTD.toFixed(2)),
      monthsProcessed,
      remainingMonths,
      annualTax: annualCalc.annualTax,
      remainingTax: Math.max(0, annualCalc.annualTax - tdsYTD),
    },
  });
}
