/**
 * POST   /api/payroll/runs/[id]/lines/[lineId]/adhoc — add one ad-hoc
 *        earning/deduction line item (e.g. a manually-entered loan
 *        recovery or bonus, since those modules don't exist yet).
 * DELETE /api/payroll/runs/[id]/lines/[lineId]/adhoc?componentId= — remove
 *        one ad-hoc item previously added this way.
 *
 * Applies the amount as a delta to otherEarningsTotal/otherDeductionsTotal
 * and recomputes netSalary from the line's current totals — deliberately
 * NOT a full re-sum-from-scratch, since PF/ESI are also stored as
 * isAdhoc:false PayrollLineComponent rows (for itemized payslip display)
 * and re-summing "all deduction components" here would double-count them
 * against pfEmployee/esiEmployee.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { checkPayrollRunEditable } from '@/lib/payrollGuard';
import { adhocComponentSchema } from '@/lib/validations/payroll';

async function loadLine(runId: number, lineId: number, companyId: number) {
  return prisma.payrollLine.findFirst({
    where: { id: lineId, payrollRunId: runId, payrollRun: { companyId } },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id, lineId } = await params;
  const runId = parseInt(id);

  const line = await loadLine(runId, parseInt(lineId), scope.companyId);
  if (!line) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const editableErr = await checkPayrollRunEditable(runId);
  if (editableErr) return editableErr;

  const parsed = adhocComponentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const component = await prisma.salaryComponent.findFirst({
    where: { id: parsed.data.salaryComponentId, companyId: scope.companyId, isActive: true, deletedAt: null },
  });
  if (!component) {
    return NextResponse.json({ error: 'Invalid or inactive salary component' }, { status: 400 });
  }
  if (component.type !== 'earning' && component.type !== 'deduction') {
    return NextResponse.json({ error: 'Only earning/deduction components can be added ad-hoc' }, { status: 400 });
  }

  const amount = Math.round(Math.abs(parsed.data.amount));
  const isEarning = component.type === 'earning';

  const [, updated] = await prisma.$transaction([
    prisma.payrollLineComponent.create({
      data: { payrollLineId: line.id, salaryComponentId: component.id, amount, isAdhoc: true },
    }),
    prisma.payrollLine.update({
      where: { id: line.id },
      data: isEarning
        ? { otherEarningsTotal: { increment: amount } }
        : { otherDeductionsTotal: { increment: amount } },
    }),
  ]);

  const netDelta = isEarning ? amount : -amount;
  const final = await prisma.payrollLine.update({
    where: { id: line.id },
    data: { netSalary: Number(updated.netSalary) + netDelta },
  });

  return NextResponse.json(final, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id, lineId } = await params;
  const runId = parseInt(id);

  const line = await loadLine(runId, parseInt(lineId), scope.companyId);
  if (!line) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const editableErr = await checkPayrollRunEditable(runId);
  if (editableErr) return editableErr;

  const componentId = Number(new URL(request.url).searchParams.get('componentId'));
  const row = await prisma.payrollLineComponent.findFirst({
    where: { id: componentId, payrollLineId: line.id, isAdhoc: true },
    include: { salaryComponent: { select: { type: true } } },
  });
  if (!row) {
    return NextResponse.json({ error: 'Ad-hoc component not found' }, { status: 404 });
  }

  const isEarning = row.salaryComponent.type === 'earning';
  const amount = Number(row.amount);

  await prisma.$transaction([
    prisma.payrollLineComponent.delete({ where: { id: row.id } }),
    prisma.payrollLine.update({
      where: { id: line.id },
      data: isEarning
        ? { otherEarningsTotal: { decrement: amount } }
        : { otherDeductionsTotal: { decrement: amount } },
    }),
  ]);

  const netDelta = isEarning ? -amount : amount;
  const final = await prisma.payrollLine.update({
    where: { id: line.id },
    data: { netSalary: { increment: netDelta } },
  });

  return NextResponse.json(final);
}
