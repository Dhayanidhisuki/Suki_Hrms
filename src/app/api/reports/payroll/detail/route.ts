/**
 * GET /api/reports/payroll/detail?year=X&month=Y&format=csv&view=summary|full
 *
 * Complete Payroll Report — source + computed data side-by-side.
 *
 * For each employee in the payroll run:
 *   - Summary view: gross, OT, other earnings, PF, ESI, PT, TDS, other
 *     deductions, net — one row per employee.
 *   - Full view: every PayrollLineComponent row (earning + deduction)
 *     with component code, name, type, amount, isAdhoc flag, plus the
 *     source salary components from EmployeeSalaryRevision and the
 *     source attendance data (payable days, LOP) that drove the calc.
 *
 * `?view=full` returns the component-level detail for all employees.
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
  const view = searchParams.get('view') ?? 'summary';

  if (!year || !month) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
  }

  const run = await prisma.payrollRun.findFirst({
    where: { companyId: scope.companyId, year, month },
  });
  if (!run) return NextResponse.json({ error: 'No payroll run for this period' }, { status: 404 });

  // ── Fetch payroll lines with full component detail (computed side) ──
  const lines = await prisma.payrollLine.findMany({
    where: { payrollRunId: run.id },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          jobInfos: {
            where: { effectiveTo: null },
            take: 1,
            select: {
              employeeTypeId: true,
              department: { select: { name: true } },
              designation: { select: { name: true } },
              wageType: true,
            },
          },
          salaryRevisions: {
            where: { effectiveTo: null },
            take: 1,
            select: {
              id: true,
              grossSalary: true,
              components: {
                include: {
                  salaryComponent: {
                    select: { id: true, code: true, name: true, type: true, includeInPf: true, includeInEsi: true, includeInGross: true, grossTier: true },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        include: {
          salaryComponent: {
            select: { id: true, code: true, name: true, type: true },
          },
        },
        orderBy: { salaryComponent: { type: 'asc' } },
      },
    },
    orderBy: { employee: { employeeCode: 'asc' } },
  });

  // ── Fetch attendance summaries (source side) ──
  const summaries = await prisma.monthlyAttendanceSummary.findMany({
    where: {
      employeeId: { in: lines.map((l) => l.employeeId) },
      year,
      month,
    },
    select: {
      employeeId: true,
      payableDays: true,
      lopDays: true,
      totalWorkingDays: true,
      presentDays: true,
      otMinutesTotal: true,
      lateMinutesTotal: true,
      earlyOutMinutesTotal: true,
      status: true,
    },
  });
  const summaryByEmp = new Map(summaries.map((s) => [s.employeeId, s]));

  // ── Build per-employee rows ──
  const rows = lines.map((l) => {
    const emp = l.employee;
    const jobInfo = emp.jobInfos[0];
    const revision = emp.salaryRevisions[0];
    const summary = summaryByEmp.get(l.employeeId);

    // Source: salary components from the active revision
    const sourceSalaryComponents = revision
      ? revision.components.map((c) => ({
          code: c.salaryComponent.code,
          name: c.salaryComponent.name,
          type: c.salaryComponent.type,
          amount: Number(c.amount),
          includeInPf: c.salaryComponent.includeInPf,
          includeInEsi: c.salaryComponent.includeInEsi,
          includeInGross: c.salaryComponent.includeInGross,
          grossTier: c.salaryComponent.grossTier,
        }))
      : [];

    // Computed: payroll line component rows
    const computedComponents = l.components.map((c) => ({
      id: c.id,
      code: c.salaryComponent.code,
      name: c.salaryComponent.name,
      type: c.salaryComponent.type,
      amount: Number(c.amount),
      isAdhoc: c.isAdhoc,
    }));

    // Split components by type for convenience
    const earningsComponents = computedComponents.filter((c) => c.type === 'earning');
    const deductionComponents = computedComponents.filter((c) => c.type === 'deduction');

    // Source vs computed reconciliation
    const sourceEarningsTotal = sourceSalaryComponents
      .filter((c) => c.type === 'earning' && c.includeInGross !== false)
      .reduce((sum, c) => sum + c.amount, 0);
    const computedGrossEarnings = Number(l.grossEarnings);
    const grossMatch = Math.abs(sourceEarningsTotal - computedGrossEarnings) <= 1; // 1 rupee tolerance

    return {
      id: l.id,
      employeeId: l.employeeId,
      employeeCode: emp.employeeCode,
      employeeName: `${emp.firstName} ${emp.lastName ?? ''}`.trim(),
      department: jobInfo?.department?.name ?? '—',
      designation: jobInfo?.designation?.name ?? '—',
      wageType: jobInfo?.wageType ?? 'monthly',
      lineStatus: l.status,
      holdReason: l.holdReason,
      // Source: attendance
      attendanceStatus: summary?.status ?? '—',
      totalWorkingDays: summary?.totalWorkingDays ?? 0,
      payableDays: summary ? Number(summary.payableDays) : 0,
      lopDays: summary ? Number(summary.lopDays) : 0,
      presentDays: summary ? Number(summary.presentDays) : 0,
      otMinutesSource: summary?.otMinutesTotal ?? 0,
      lateMinutesSource: summary?.lateMinutesTotal ?? 0,
      earlyOutMinutesSource: summary?.earlyOutMinutesTotal ?? 0,
      // Source: salary revision
      sourceGrossSalary: revision ? Number(revision.grossSalary) : 0,
      sourceSalaryComponents,
      // Computed: payroll line totals
      totalWorkingDaysComputed: l.totalWorkingDays,
      payableDaysComputed: Number(l.payableDays),
      lopDaysComputed: l.lopDays,
      grossEarnings: Number(l.grossEarnings),
      fixedGross: Number(l.fixedGross),
      additionalGross: Number(l.additionalGross),
      performanceIncentive: Number(l.performanceIncentive),
      otAmount: Number(l.otAmount),
      otIncentiveAmount: Number(l.otIncentiveAmount),
      otherEarningsTotal: Number(l.otherEarningsTotal),
      pfEmployee: Number(l.pfEmployee),
      pfEmployer: Number(l.pfEmployer),
      epsEmployer: Number(l.epsEmployer),
      esiEmployee: Number(l.esiEmployee),
      esiEmployer: Number(l.esiEmployer),
      professionalTax: Number(l.professionalTax),
      tds: Number(l.tds),
      otherDeductionsTotal: Number(l.otherDeductionsTotal),
      lomAmount: Number(l.lomAmount),
      lwfAmount: Number(l.lwfAmount),
      healthInsurance: Number(l.healthInsurance),
      licAmount: Number(l.licAmount),
      netSalary: Number(l.netSalary),
      pfApplicable: l.pfApplicable,
      esiApplicable: l.esiApplicable,
      ptApplicable: l.ptApplicable,
      // Computed: component detail
      computedComponents,
      earningsComponents,
      deductionComponents,
      // Reconciliation
      sourceEarningsTotal,
      computedGrossEarnings,
      grossMatch,
    };
  });

  // ── Totals ──
  const okLines = rows.filter((r) => r.lineStatus === 'OK');
  const totals = okLines.reduce(
    (acc, r) => {
      acc.grossEarnings += r.grossEarnings;
      acc.fixedGross += r.fixedGross;
      acc.additionalGross += r.additionalGross;
      acc.performanceIncentive += r.performanceIncentive;
      acc.otAmount += r.otAmount;
      acc.otIncentiveAmount += r.otIncentiveAmount;
      acc.otherEarningsTotal += r.otherEarningsTotal;
      acc.pfEmployee += r.pfEmployee;
      acc.pfEmployer += r.pfEmployer;
      acc.epsEmployer += r.epsEmployer;
      acc.esiEmployee += r.esiEmployee;
      acc.esiEmployer += r.esiEmployer;
      acc.professionalTax += r.professionalTax;
      acc.tds += r.tds;
      acc.otherDeductionsTotal += r.otherDeductionsTotal;
      acc.lomAmount += r.lomAmount;
      acc.lwfAmount += r.lwfAmount;
      acc.healthInsurance += r.healthInsurance;
      acc.licAmount += r.licAmount;
      acc.netSalary += r.netSalary;
      return acc;
    },
    {
      grossEarnings: 0, fixedGross: 0, additionalGross: 0,
      performanceIncentive: 0, otAmount: 0, otIncentiveAmount: 0,
      otherEarningsTotal: 0, pfEmployee: 0, pfEmployer: 0, epsEmployer: 0,
      esiEmployee: 0, esiEmployer: 0, professionalTax: 0, tds: 0,
      otherDeductionsTotal: 0, lomAmount: 0, lwfAmount: 0, healthInsurance: 0,
      licAmount: 0, netSalary: 0,
    }
  );

  // ── CSV export ──
  if (format === 'csv') {
    if (view === 'full') {
      // Full component-level CSV
      const headers = [
        'Employee Code', 'Employee Name', 'Department', 'Component Code', 'Component Name',
        'Type', 'Amount', 'Is Adhoc',
      ];
      const csvRows: string[] = [];
      for (const r of rows) {
        for (const c of r.computedComponents) {
          csvRows.push([
            r.employeeCode, r.employeeName, r.department, c.code, c.name,
            c.type, c.amount.toFixed(2), c.isAdhoc ? 'Yes' : 'No',
          ].map((v) => `"${v}"`).join(','));
        }
      }
      const csv = [headers.join(','), ...csvRows].join('\n');
      return new NextResponse(csv, {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="payroll_detail_${year}_${month}.csv"` },
      });
    }

    // Summary CSV
    const headers = [
      'Employee Code', 'Employee Name', 'Department', 'Designation', 'Status',
      'Payable Days', 'LOP Days', 'Source Gross', 'Computed Gross',
      'Fixed Gross', 'Additional Gross', 'OT Amount', 'OT Incentive',
      'Performance Incentive', 'Other Earnings',
      'PF Employee', 'PF Employer', 'EPS Employer', 'ESI Employee', 'ESI Employer',
      'Professional Tax', 'TDS', 'LOM Amount', 'LWF Amount', 'Health Insurance',
      'LIC Amount', 'Other Deductions', 'Net Salary',
    ];
    const csvRows = rows.map((r) => [
      r.employeeCode, r.employeeName, r.department, r.designation, r.lineStatus,
      r.payableDays, r.lopDays, r.sourceGrossSalary.toFixed(2), r.grossEarnings.toFixed(2),
      r.fixedGross.toFixed(2), r.additionalGross.toFixed(2), r.otAmount.toFixed(2), r.otIncentiveAmount.toFixed(2),
      r.performanceIncentive.toFixed(2), r.otherEarningsTotal.toFixed(2),
      r.pfEmployee.toFixed(2), r.pfEmployer.toFixed(2), r.epsEmployer.toFixed(2), r.esiEmployee.toFixed(2), r.esiEmployer.toFixed(2),
      r.professionalTax.toFixed(2), r.tds.toFixed(2), r.lomAmount.toFixed(2), r.lwfAmount.toFixed(2), r.healthInsurance.toFixed(2),
      r.licAmount.toFixed(2), r.otherDeductionsTotal.toFixed(2), r.netSalary.toFixed(2),
    ]);
    const csv = [headers.join(','), ...csvRows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="payroll_summary_${year}_${month}.csv"` },
    });
  }

  // ── JSON response ──
  if (view === 'full') {
    // Return component-level detail for all employees
    const flatComponents: Array<{
      employeeCode: string;
      employeeName: string;
      department: string;
      componentCode: string;
      componentName: string;
      type: string;
      amount: number;
      isAdhoc: boolean;
    }> = [];
    for (const r of rows) {
      for (const c of r.computedComponents) {
        flatComponents.push({
          employeeCode: r.employeeCode,
          employeeName: r.employeeName,
          department: r.department,
          componentCode: c.code,
          componentName: c.name,
          type: c.type,
          amount: c.amount,
          isAdhoc: c.isAdhoc,
        });
      }
    }
    return NextResponse.json({
      run: { id: run.id, year: run.year, month: run.month, status: run.status },
      rows: flatComponents,
      totals,
    });
  }

  return NextResponse.json({
    run: { id: run.id, year: run.year, month: run.month, status: run.status },
    headcount: {
      total: lines.length,
      ok: okLines.length,
      hold: lines.filter((l) => l.status === 'HOLD').length,
    },
    rows,
    totals,
  });
}
