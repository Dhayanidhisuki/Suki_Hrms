/**
 * GET /api/payroll/runs/[id]/reconciliation
 *
 * Returns a reconciliation report comparing payroll calculation totals
 * against component-level sums, identifying discrepancies between
 * PayrollLine totals and the sum of PayrollLineComponent rows.
 * Also flags employees with missing bank details, missing salary
 * structure, or statutory calculation anomalies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const runId = parseInt(id);

  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, companyId: scope.companyId },
  });
  if (!run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });

  const lines = await prisma.payrollLine.findMany({
    where: { payrollRunId: runId },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          bankDetail: { select: { accountNumber: true } },
          salaryRevisions: { where: { effectiveTo: null }, take: 1, select: { id: true } },
        },
      },
      components: { include: { salaryComponent: { select: { type: true } } } },
    },
    orderBy: { employeeId: 'asc' },
  });

  const discrepancies: Array<{
    employeeCode: string;
    name: string;
    type: string;
    detail: string;
  }> = [];

  let totalGross = 0;
  let totalOtherEarnings = 0;
  let totalNet = 0;
  let totalDeductions = 0;
  let componentEarningsSum = 0;
  let componentDeductionsSum = 0;

  for (const line of lines) {
    totalGross += Number(line.grossEarnings);
    totalOtherEarnings += Number(line.otherEarningsTotal);
    totalNet += Number(line.netSalary);
    totalDeductions += Number(line.otherDeductionsTotal);

    // Sum component amounts by type.
    const earningsSum = line.components
      .filter((c) => c.salaryComponent.type === 'earning')
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const deductionsSum = line.components
      .filter((c) => c.salaryComponent.type === 'deduction')
      .reduce((sum, c) => sum + Number(c.amount), 0);
    componentEarningsSum += earningsSum;
    componentDeductionsSum += deductionsSum;

    const empName = `${line.employee.firstName} ${line.employee.lastName}`.trim();

    // Check: missing bank details (for OK lines with net > 0).
    if (line.status === 'OK' && Number(line.netSalary) > 0 && !line.employee.bankDetail?.accountNumber) {
      discrepancies.push({
        employeeCode: line.employee.employeeCode,
        name: empName,
        type: 'MISSING_BANK',
        detail: 'No bank account on file — bank file generation will skip this employee',
      });
    }

    // Check: missing salary structure.
    if (line.employee.salaryRevisions.length === 0) {
      discrepancies.push({
        employeeCode: line.employee.employeeCode,
        name: empName,
        type: 'MISSING_SALARY',
        detail: 'No active salary revision — payroll may be incorrect',
      });
    }

    // Check: negative net salary.
    if (Number(line.netSalary) < 0) {
      discrepancies.push({
        employeeCode: line.employee.employeeCode,
        name: empName,
        type: 'NEGATIVE_NET',
        detail: `Net salary is negative (${Number(line.netSalary).toFixed(2)})`,
      });
    }

    // Check: gross mismatch (recurring + ad-hoc earnings vs component earnings sum).
    // grossEarnings holds LOP-adjusted recurring earnings only; ad-hoc earnings
    // land in otherEarningsTotal. Their sum should equal the total of all
    // earning PayrollLineComponent rows. Allow 1 rupee rounding tolerance.
    const totalEarnings = Number(line.grossEarnings) + Number(line.otherEarningsTotal);
    const grossDiff = Math.abs(totalEarnings - earningsSum);
    if (grossDiff > 1) {
      discrepancies.push({
        employeeCode: line.employee.employeeCode,
        name: empName,
        type: 'GROSS_MISMATCH',
        detail: `Gross+OtherEarnings (${totalEarnings.toFixed(2)}) vs component sum (${earningsSum.toFixed(2)}) differ by ${grossDiff.toFixed(2)}`,
      });
    }
  }

  // Summary totals.
  const totalEarningsAll = totalGross + totalOtherEarnings;
  const summary = {
    headcount: lines.length,
    okCount: lines.filter((l) => l.status === 'OK').length,
    holdCount: lines.filter((l) => l.status === 'HOLD').length,
    totalGross: totalGross.toFixed(2),
    totalOtherEarnings: totalOtherEarnings.toFixed(2),
    totalEarnings: totalEarningsAll.toFixed(2),
    totalNet: totalNet.toFixed(2),
    totalDeductions: totalDeductions.toFixed(2),
    componentEarningsSum: componentEarningsSum.toFixed(2),
    componentDeductionsSum: componentDeductionsSum.toFixed(2),
    grossReconciled: Math.abs(totalEarningsAll - componentEarningsSum) <= lines.length, // 1 rupee tolerance per line
  };

  return NextResponse.json({
    run: { id: run.id, year: run.year, month: run.month, status: run.status },
    summary,
    discrepancies,
    discrepancyCount: discrepancies.length,
  });
}
