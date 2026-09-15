/**
 * POST /api/payroll/runs/[id]/apply-benefit-rates
 *
 * For every line in this run, looks up the employee's current
 * EmployeeType and applies the matching BenefitRateByEmployeeType rows
 * (Canteen Deduction, Petrol Allowance, or any other component an admin
 * has rated this way) as ad-hoc PayrollLineComponent rows — same mechanism
 * as the single-line adhoc route, just run for every employee in the run
 * in one call. Canteen-type (deduction) rates are prorated by
 * payableDays/totalWorkingDays (BRD: "prorated based on absence"); earning
 * rates (e.g. Petrol Allowance) are applied in full — the BRD gave no
 * proration rule for those. Skips a component already applied ad-hoc to a
 * line this run (idempotent — safe to click again after adding a new rate
 * without double-crediting employees already done).
 * Benefit components without a linked salary component are ignored by payroll.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { checkPayrollRunEditable } from '@/lib/payrollGuard';
import { applyAdhocLine } from '@/lib/payrollAdhoc';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const runId = parseInt(id);
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, companyId: scope.companyId } });
  if (!run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });

  const editableErr = await checkPayrollRunEditable(runId);
  if (editableErr) return editableErr;

  const rates = await prisma.benefitRateByEmployeeType.findMany({
    where: { companyId: scope.companyId, isActive: true, salaryComponentId: { not: null } },
    include: { salaryComponent: { select: { id: true, type: true, code: true } } },
  });
  if (rates.length === 0) {
    return NextResponse.json({ error: 'No active benefit components with a payroll salary component configured — set them up under Masters > Benefit Components first' }, { status: 400 });
  }
  const ratesByEmployeeType = new Map<number, typeof rates>();
  for (const r of rates) {
    const list = ratesByEmployeeType.get(r.employeeTypeId) ?? [];
    list.push(r);
    ratesByEmployeeType.set(r.employeeTypeId, list);
  }

  const lines = await prisma.payrollLine.findMany({
    where: { payrollRunId: runId },
    include: {
      employee: { select: { id: true, jobInfos: { where: { effectiveTo: null }, take: 1, select: { employeeTypeId: true } } } },
      components: { where: { isAdhoc: true }, select: { salaryComponentId: true } },
    },
  });

  let applied = 0;
  let skippedNoRate = 0;
  let skippedAlreadyApplied = 0;
  let skippedNoSalaryComponent = 0;

  for (const line of lines) {
    const employeeTypeId = line.employee.jobInfos[0]?.employeeTypeId;
    const applicableRates = employeeTypeId ? ratesByEmployeeType.get(employeeTypeId) ?? [] : [];
    if (applicableRates.length === 0) {
      skippedNoRate++;
      continue;
    }
    const alreadyApplied = new Set(line.components.map((c) => c.salaryComponentId));

    for (const rate of applicableRates) {
      if (!rate.salaryComponentId || !rate.salaryComponent) {
        skippedNoSalaryComponent++;
        continue;
      }
      if (alreadyApplied.has(rate.salaryComponentId)) {
        skippedAlreadyApplied++;
        continue;
      }
      const isDeduction = rate.salaryComponent.type === 'deduction';
      const factor = isDeduction && line.totalWorkingDays > 0 ? Number(line.payableDays) / line.totalWorkingDays : 1;
      const amount = Number(rate.amount) * factor;
      await applyAdhocLine(line.id, rate.salaryComponentId, amount);
      applied++;
    }
  }

  return NextResponse.json({
    applied,
    skippedNoRate,
    skippedAlreadyApplied,
    skippedNoSalaryComponent,
    totalLines: lines.length,
    message: `Applied ${applied} benefit line(s) across ${lines.length} employee(s) — ${skippedNoRate} had no matching rate, ${skippedAlreadyApplied} already had it applied, ${skippedNoSalaryComponent} had no payroll salary component.`,
  });
}
