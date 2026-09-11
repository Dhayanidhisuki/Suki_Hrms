/**
 * GET /api/reports/payroll-summary?year=X&month=Y
 *
 * Company-level payroll summary report — totals by component type,
 * headcount, gross/net, statutory breakdown. Supports CSV export via
 * ?format=csv.
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
      employee: {
        select: {
          employeeCode: true, firstName: true, lastName: true,
          jobInfos: { where: { effectiveTo: null }, take: 1, select: { employeeTypeId: true, department: { select: { name: true } } } },
        },
      },
    },
  });

  const okLines = lines.filter((l) => l.status === 'OK');
  const holdLines = lines.filter((l) => l.status === 'HOLD');

  const totals = okLines.reduce(
    (acc, l) => {
      acc.grossEarnings += Number(l.grossEarnings);
      acc.otAmount += Number(l.otAmount);
      acc.otherEarnings += Number(l.otherEarningsTotal);
      acc.pfEmployee += Number(l.pfEmployee);
      acc.pfEmployer += Number(l.pfEmployer);
      acc.esiEmployee += Number(l.esiEmployee);
      acc.esiEmployer += Number(l.esiEmployer);
      acc.professionalTax += Number(l.professionalTax);
      acc.tds += Number(l.tds);
      acc.otherDeductions += Number(l.otherDeductionsTotal);
      acc.lomAmount += Number(l.lomAmount);
      acc.lwfAmount += Number(l.lwfAmount);
      acc.healthInsurance += Number(l.healthInsurance);
      acc.licAmount += Number(l.licAmount);
      acc.netSalary += Number(l.netSalary);
      return acc;
    },
    { grossEarnings: 0, otAmount: 0, otherEarnings: 0, pfEmployee: 0, pfEmployer: 0, esiEmployee: 0, esiEmployer: 0, professionalTax: 0, tds: 0, otherDeductions: 0, lomAmount: 0, lwfAmount: 0, healthInsurance: 0, licAmount: 0, netSalary: 0 }
  );

  // By department.
  const byDept = new Map<string, { count: number; gross: number; net: number }>();
  for (const l of okLines) {
    const dept = l.employee.jobInfos[0]?.department?.name ?? 'Unknown';
    const existing = byDept.get(dept) ?? { count: 0, gross: 0, net: 0 };
    existing.count++;
    existing.gross += Number(l.grossEarnings);
    existing.net += Number(l.netSalary);
    byDept.set(dept, existing);
  }

  const report = {
    run: { id: run.id, year: run.year, month: run.month, status: run.status },
    headcount: { total: lines.length, ok: okLines.length, hold: holdLines.length },
    totals,
    byDepartment: Array.from(byDept.entries()).map(([dept, data]) => ({ department: dept, ...data })),
    holdReasons: holdLines.map((l) => ({
      employeeCode: l.employee.employeeCode,
      name: `${l.employee.firstName} ${l.employee.lastName}`.trim(),
      holdReason: l.holdReason,
    })),
  };

  if (format === 'csv') {
    const headers = ['Metric', 'Amount'];
    const rows = [
      ['Headcount (Total)', String(lines.length)],
      ['Headcount (OK)', String(okLines.length)],
      ['Headcount (HOLD)', String(holdLines.length)],
      ['Gross Earnings', totals.grossEarnings.toFixed(2)],
      ['OT Amount', totals.otAmount.toFixed(2)],
      ['Other Earnings', totals.otherEarnings.toFixed(2)],
      ['PF Employee', totals.pfEmployee.toFixed(2)],
      ['PF Employer', totals.pfEmployer.toFixed(2)],
      ['ESI Employee', totals.esiEmployee.toFixed(2)],
      ['ESI Employer', totals.esiEmployer.toFixed(2)],
      ['Professional Tax', totals.professionalTax.toFixed(2)],
      ['TDS', totals.tds.toFixed(2)],
      ['LOM Amount', totals.lomAmount.toFixed(2)],
      ['LWF Amount', totals.lwfAmount.toFixed(2)],
      ['Health Insurance', totals.healthInsurance.toFixed(2)],
      ['LIC Amount', totals.licAmount.toFixed(2)],
      ['Other Deductions', totals.otherDeductions.toFixed(2)],
      ['Net Salary', totals.netSalary.toFixed(2)],
    ];
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="payroll_summary_${year}_${month}.csv"` },
    });
  }

  return NextResponse.json(report);
}
