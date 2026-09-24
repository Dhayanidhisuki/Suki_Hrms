/**
 * GET /api/payroll/runs/[id]/payslip-pdf?employeeId=X
 *
 * Returns structured payslip data for one employee (or all employees when
 * no employeeId is given — bulk payslip). The client renders this as a
 * printable view or generates a PDF via the browser's print-to-PDF.
 *
 * Includes PayrollDisplayConfig settings (decimal places, show YTD, etc.)
 * so the client renders the payslip per company configuration.
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
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');

  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, companyId: scope.companyId },
  });
  if (!run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });

  // Load display config for formatting.
  const displayConfig = await prisma.payrollDisplayConfig.findUnique({ where: { companyId: scope.companyId } });
  const decimalPlaces = displayConfig?.decimalPlaces ?? 2;

  // Load line(s).
  const lineWhere: Record<string, unknown> = { payrollRunId: runId };
  if (employeeId) lineWhere.employeeId = Number(employeeId);

  const lines = await prisma.payrollLine.findMany({
    where: lineWhere,
    include: {
      employee: {
        select: {
          id: true,
          oldEmployeeCode: true,
          firstName: true,
          lastName: true,
          jobInfos: {
            where: { effectiveTo: null },
            take: 1,
            select: { designation: true, department: true },
          },
        },
      },
      components: {
        include: { salaryComponent: { select: { code: true, name: true, type: true } } },
        orderBy: { salaryComponent: { type: 'asc' } },
      },
    },
    orderBy: { employeeId: 'asc' },
  });

  if (lines.length === 0) {
    return NextResponse.json({ error: 'No payslip data found' }, { status: 404 });
  }

  const payslips = await Promise.all(lines.map(async (line) => {
    const emp = line.employee;
    const earnings = line.components.filter((c) => c.salaryComponent.type === 'earning');
    const deductions = line.components.filter((c) => c.salaryComponent.type === 'deduction');

    // Phase 15 — YTD totals: sum all PayrollLines for this employee in the
    // same calendar year up to and including this run's month.
    let ytdData = null;
    if (displayConfig?.showYTD) {
      const ytdLines = await prisma.payrollLine.findMany({
        where: {
          employeeId: emp.id,
          payrollRun: { year: run.year, companyId: scope.companyId },
        },
        select: {
          grossEarnings: true,
          netSalary: true,
          pfEmployee: true,
          esiEmployee: true,
          professionalTax: true,
          tds: true,
        },
      });
      ytdData = {
        grossEarnings: ytdLines.reduce((s, l) => s + Number(l.grossEarnings), 0).toFixed(decimalPlaces),
        netSalary: ytdLines.reduce((s, l) => s + Number(l.netSalary), 0).toFixed(decimalPlaces),
        pfEmployee: ytdLines.reduce((s, l) => s + Number(l.pfEmployee), 0).toFixed(decimalPlaces),
        esiEmployee: ytdLines.reduce((s, l) => s + Number(l.esiEmployee), 0).toFixed(decimalPlaces),
        professionalTax: ytdLines.reduce((s, l) => s + Number(l.professionalTax), 0).toFixed(decimalPlaces),
        tds: ytdLines.reduce((s, l) => s + Number(l.tds), 0).toFixed(decimalPlaces),
      };
    }

    // Phase 15 — Leave balance: current LeaveBalance for this employee.
    let leaveBalance = null;
    if (displayConfig?.showLeaveBalance) {
      const balances = await prisma.leaveBalance.findMany({
        where: { employeeId: emp.id, leaveMaster: { deletedAt: null } },
        include: { leaveMaster: { select: { code: true, name: true } } },
      });
      leaveBalance = balances.map((b) => ({
        leaveType: b.leaveMaster?.name ?? b.leaveMaster?.code ?? 'Unknown',
        opening: Number(b.openingBalance),
        accrued: Number(b.accrued),
        availed: Number(b.availed),
        closing: Number(b.closingBalance),
      }));
    }

    // Phase 15 — Tax breakdown: TDS declaration summary if available.
    let taxBreakdown = null;
    if (displayConfig?.showTaxBreakdown) {
      const fyYear = run.month >= 4 ? run.year : run.year - 1;
      const declaration = await prisma.tdsInvestmentDeclaration.findFirst({
        where: { employeeId: emp.id, financialYear: fyYear, status: 'approved' },
      });
      if (declaration) {
        const totalDeductions = Number(declaration.section80C) + Number(declaration.section80D) +
          Number(declaration.section80CCD) + Number(declaration.section80G) +
          Number(declaration.section80E) + Number(declaration.section80TTA) +
          Number(declaration.hraExemption) + Number(declaration.otherDeductions);
        taxBreakdown = {
          financialYear: `${fyYear}-${fyYear + 1}`,
          regime: declaration.regime,
          section80C: Number(declaration.section80C).toFixed(decimalPlaces),
          section80D: Number(declaration.section80D).toFixed(decimalPlaces),
          hraExemption: Number(declaration.hraExemption).toFixed(decimalPlaces),
          totalDeductions: totalDeductions.toFixed(decimalPlaces),
          otherIncome: Number(declaration.otherIncome).toFixed(decimalPlaces),
          tdsThisMonth: Number(line.tds).toFixed(decimalPlaces),
        };
      }
    }

    return {
      employee: {
        code: emp.oldEmployeeCode ?? '',
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        designation: emp.jobInfos[0]?.designation ?? null,
        department: emp.jobInfos[0]?.department ?? null,
      },
      period: { month: run.month, year: run.year },
      attendance: {
        totalWorkingDays: line.totalWorkingDays,
        payableDays: Number(line.payableDays),
        lopDays: line.lopDays,
      },
      earnings: earnings.map((c) => ({
        name: c.salaryComponent.name,
        amount: Number(c.amount).toFixed(decimalPlaces),
      })),
      deductions: deductions.map((c) => ({
        name: c.salaryComponent.name,
        amount: Number(c.amount).toFixed(decimalPlaces),
        percent: displayConfig?.showDeductionPercent
          ? Number(line.grossEarnings) > 0
            ? ((Number(c.amount) / Number(line.grossEarnings)) * 100).toFixed(2) + '%'
            : '0%'
          : null,
      })),
      totals: {
        grossEarnings: Number(line.grossEarnings).toFixed(decimalPlaces),
        otAmount: Number(line.otAmount).toFixed(decimalPlaces),
        otherEarnings: Number(line.otherEarningsTotal).toFixed(decimalPlaces),
        pfEmployee: Number(line.pfEmployee).toFixed(decimalPlaces),
        esiEmployee: Number(line.esiEmployee).toFixed(decimalPlaces),
        professionalTax: Number(line.professionalTax).toFixed(decimalPlaces),
        tds: Number(line.tds).toFixed(decimalPlaces),
        otherDeductions: Number(line.otherDeductionsTotal).toFixed(decimalPlaces),
        lomAmount: Number(line.lomAmount).toFixed(decimalPlaces),
        lwfAmount: Number(line.lwfAmount).toFixed(decimalPlaces),
        healthInsurance: Number(line.healthInsurance).toFixed(decimalPlaces),
        netSalary: Number(line.netSalary).toFixed(decimalPlaces),
      },
      ytd: ytdData,
      leaveBalance,
      taxBreakdown,
    };
  }));

  return NextResponse.json({
    displayConfig: {
      decimalPlaces,
      showDeductionPercent: displayConfig?.showDeductionPercent ?? true,
      showYTD: displayConfig?.showYTD ?? false,
      showLeaveBalance: displayConfig?.showLeaveBalance ?? false,
      showTaxBreakdown: displayConfig?.showTaxBreakdown ?? false,
    },
    payslips: employeeId ? payslips[0] : payslips,
  });
}
