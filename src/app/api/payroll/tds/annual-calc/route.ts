/**
 * GET /api/payroll/tds/annual-calc?employeeId=X&financialYear=YYYY
 *
 * Returns the annual TDS calculation for an employee. Computes grossYTD
 * from approved payroll lines in the financial year (April-March per
 * TdsRegimeConfig.financialYearStart) and alreadyDeductedTDS from the
 * same lines' tds field.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { calculateAnnualTds } from '@/lib/tdsCalculation';

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

  // Load the company's TDS config to determine FY start month.
  const config = await prisma.tdsRegimeConfig.findUnique({ where: { companyId: scope.companyId } });
  const fyStartMonth = config?.financialYearStart ?? 4; // April

  // Determine the calendar months that fall in this financial year.
  // FY 2026 with start month 4 (April) spans April 2026 - March 2027.
  const fyStartYear = financialYear;
  const fyEndYear = financialYear + 1;

  // Build the date range for the financial year.
  const fyStart = new Date(Date.UTC(fyStartYear, fyStartMonth - 1, 1));
  const fyEnd = new Date(Date.UTC(fyEndYear, fyStartMonth - 1, 1));

  // Sum gross and TDS from approved/locked payroll lines in this FY.
  const lines = await prisma.payrollLine.findMany({
    where: {
      employeeId: empId,
      payrollRun: {
        companyId: scope.companyId,
        status: { in: ['APPROVED', 'LOCKED'] },
      },
      // Filter by the payroll run's year+month falling in the FY.
      // We'll filter in code since the run's year/month are separate fields.
    },
    include: {
      payrollRun: { select: { year: true, month: true, status: true } },
    },
  });

  let grossYTD = 0;
  let alreadyDeductedTDS = 0;
  let monthsProcessed = 0;
  for (const line of lines) {
    const runDate = new Date(Date.UTC(line.payrollRun.year, line.payrollRun.month - 1, 1));
    if (runDate >= fyStart && runDate < fyEnd) {
      grossYTD += Number(line.grossEarnings);
      alreadyDeductedTDS += Number(line.tds);
      monthsProcessed++;
    }
  }

  // Remaining months in the FY (12 - months processed).
  const remainingMonths = Math.max(0, 12 - monthsProcessed);

  const result = await calculateAnnualTds(
    empId,
    financialYear,
    grossYTD,
    alreadyDeductedTDS,
    remainingMonths
  );

  return NextResponse.json(result);
}
