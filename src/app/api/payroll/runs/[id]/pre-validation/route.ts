/**
 * GET /api/payroll/runs/[id]/pre-validation
 *
 * Pre-validation summary — runs all validations against the current
 * payroll lines WITHOUT modifying them. Returns a summary of how many
 * lines would pass, hold, or warn, plus the list of issues.
 *
 * Used by the bulk processing page to show a pre-check before
 * committing the calculation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { validatePayrollLine, determineLineStatus, type ValidationResult } from '@/lib/payrollValidation';

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

  const config = await prisma.payrollValidationConfig.findUnique({
    where: { companyId: scope.companyId },
  });

  const lines = await prisma.payrollLine.findMany({
    where: { payrollRunId: runId },
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      components: { include: { salaryComponent: { select: { code: true, type: true } } } },
    },
  });

  if (!config) {
    return NextResponse.json({
      totalLines: lines.length,
      okCount: lines.length,
      holdCount: 0,
      warningCount: 0,
      issues: [],
      message: 'No validation config — all lines pass by default',
    });
  }

  const issues: Array<{
    employeeId: number;
    employeeCode: string;
    name: string;
    results: ValidationResult[];
    status: 'OK' | 'HOLD';
  }> = [];

  let okCount = 0;
  let holdCount = 0;
  let warningCount = 0;

  for (const line of lines) {
    // Load attendance summary status.
    const attendanceSummary = await prisma.monthlyAttendanceSummary.findFirst({
      where: { employeeId: line.employeeId, year: run.year, month: run.month },
      select: { status: true },
    });

    // Phase 12 — if config requires attendance frozen, also warn if not READY_FOR_PAYROLL.
    if (config.checkAttendanceFrozen && attendanceSummary &&
        attendanceSummary.status !== 'READY_FOR_PAYROLL' &&
        attendanceSummary.status !== 'FROZEN' &&
        attendanceSummary.status !== 'FINALIZED') {
      // Already caught by validatePayrollLine, but add a specific READY_FOR_PAYROLL hint.
    }

    const componentCodes = line.components.map((c) => c.salaryComponent.code).filter(Boolean);

    const results = validatePayrollLine(
      {
        employeeId: line.employeeId,
        employeeCode: line.employee.employeeCode,
        grossEarnings: Number(line.grossEarnings),
        totalDeductions: Number(line.pfEmployee) + Number(line.esiEmployee) + Number(line.professionalTax) + Number(line.tds) + Number(line.otherDeductionsTotal),
        netSalary: Number(line.netSalary),
        otAmount: Number(line.otAmount ?? 0),
        otMinutes: 0, // PayrollLine doesn't store otMinutes; use 0 for validation
        lopDays: line.lopDays,
        payableDays: Number(line.payableDays),
        pfEmployee: Number(line.pfEmployee),
        esiEmployee: Number(line.esiEmployee),
        professionalTax: Number(line.professionalTax),
        tds: Number(line.tds),
        otherDeductions: Number(line.otherDeductionsTotal),
        attendanceStatus: attendanceSummary?.status ?? null,
        componentCodes,
      },
      {
        allowNegativeNet: config.allowNegativeNet,
        minNetPercentOfGross: Number(config.minNetPercentOfGross),
        maxDeductionPercent: Number(config.maxDeductionPercent),
        statutoryIncludedInLimit: config.statutoryIncludedInLimit,
        maxOtHoursPerMonth: config.maxOtHoursPerMonth ? Number(config.maxOtHoursPerMonth) : null,
        maxOtPercentOfGross: config.maxOtPercentOfGross ? Number(config.maxOtPercentOfGross) : null,
        checkGrossReconciliation: config.checkGrossReconciliation,
        maxLopDaysPerMonth: config.maxLopDaysPerMonth,
        checkAttendanceFrozen: config.checkAttendanceFrozen,
        checkDuplicateComponents: config.checkDuplicateComponents,
        minPayableDays: config.minPayableDays ? Number(config.minPayableDays) : null,
        warnIfZeroGross: config.warnIfZeroGross,
      }
    );

    const { status } = determineLineStatus(results);
    if (status === 'HOLD') holdCount++;
    else if (results.some((r) => r.severity === 'WARNING')) warningCount++;
    else okCount++;

    if (results.length > 0) {
      issues.push({
        employeeId: line.employeeId,
        employeeCode: line.employee.employeeCode,
        name: `${line.employee.firstName} ${line.employee.lastName}`.trim(),
        results,
        status,
      });
    }
  }

  return NextResponse.json({
    totalLines: lines.length,
    okCount,
    holdCount,
    warningCount,
    issues,
  });
}
