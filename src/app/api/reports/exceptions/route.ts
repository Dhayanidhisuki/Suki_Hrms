/**
 * GET /api/reports/exceptions?year=X&month=Y
 *
 * Exception report — employees on HOLD, with negative net, zero gross,
 * or other payroll validation issues. Supports CSV export via ?format=csv.
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
  const year = parseInt(searchParams.get('year') ?? '0');
  const month = parseInt(searchParams.get('month') ?? '0');
  const format = searchParams.get('format');

  if (!year || !month) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
  }

  const run = await prisma.payrollRun.findFirst({
    where: { companyId: scope.companyId, year, month },
  });
  if (!run) return NextResponse.json({ error: 'No payroll run for this period' }, { status: 404 });

  const lines = await prisma.payrollLine.findMany({
    where: { payrollRunId: run.id },
    include: {
      employee: { select: { employeeCode: true, firstName: true, lastName: true } },
    },
  });

  const exceptions: Array<{
    employeeCode: string;
    name: string;
    exceptionType: string;
    details: string;
    severity: 'ERROR' | 'WARNING';
  }> = [];

  for (const l of lines) {
    const empName = `${l.employee.firstName} ${l.employee.lastName}`.trim();

    if (l.status === 'HOLD') {
      exceptions.push({
        employeeCode: l.employee.employeeCode, name: empName,
        exceptionType: 'HOLD', details: l.holdReason ?? 'On hold', severity: 'ERROR',
      });
    }
    if (Number(l.netSalary) < 0) {
      exceptions.push({
        employeeCode: l.employee.employeeCode, name: empName,
        exceptionType: 'NEGATIVE_NET', details: `Net salary is ${Number(l.netSalary).toFixed(2)}`, severity: 'ERROR',
      });
    }
    if (Number(l.grossEarnings) === 0) {
      exceptions.push({
        employeeCode: l.employee.employeeCode, name: empName,
        exceptionType: 'ZERO_GROSS', details: 'Gross earnings are zero', severity: 'WARNING',
      });
    }
    const totalDeductions = Number(l.pfEmployee) + Number(l.esiEmployee) + Number(l.professionalTax) +
      Number(l.tds) + Number(l.otherDeductionsTotal) + Number(l.lomAmount) + Number(l.lwfAmount) +
      Number(l.healthInsurance) + Number(l.licAmount);
    if (Number(l.grossEarnings) > 0 && totalDeductions / Number(l.grossEarnings) > 0.5) {
      exceptions.push({
        employeeCode: l.employee.employeeCode, name: empName,
        exceptionType: 'HIGH_DEDUCTIONS', details: `Deductions are ${((totalDeductions / Number(l.grossEarnings)) * 100).toFixed(1)}% of gross`, severity: 'WARNING',
      });
    }
  }

  const report = {
    period: { year, month },
    runStatus: run.status,
    totalLines: lines.length,
    totalExceptions: exceptions.length,
    errorCount: exceptions.filter((e) => e.severity === 'ERROR').length,
    warningCount: exceptions.filter((e) => e.severity === 'WARNING').length,
    exceptions,
  };

  if (format === 'csv') {
    const headers = ['Code', 'Name', 'Exception Type', 'Details', 'Severity'];
    const rows = exceptions.map((e) => [e.employeeCode, `"${e.name}"`, e.exceptionType, `"${e.details}"`, e.severity]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="exceptions_${year}_${month}.csv"` },
    });
  }

  return NextResponse.json(report);
}
