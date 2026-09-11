/**
 * POST /api/payroll/manual-arrears/[id]/apply
 * Body: { payrollRunId: number }
 *
 * Applies an approved manual arrear to a payroll run as an ad-hoc
 * PayrollLineComponent on the employee's payroll line.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

const bodySchema = z.object({ payrollRunId: z.coerce.number().int().positive() });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.manage');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const arrearId = parseInt(id);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'payrollRunId required' }, { status: 400 });
  }

  const arrear = await prisma.manualArrear.findFirst({
    where: { id: arrearId, companyId: scope.companyId },
  });
  if (!arrear) return NextResponse.json({ error: 'Arrear not found' }, { status: 404 });
  if (arrear.status !== 'APPROVED') {
    return NextResponse.json({ error: `Arrear must be APPROVED (current: ${arrear.status})` }, { status: 409 });
  }

  // Verify the payroll run belongs to this company.
  const run = await prisma.payrollRun.findFirst({
    where: { id: parsed.data.payrollRunId, companyId: scope.companyId },
  });
  if (!run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });

  // Find the employee's payroll line in this run.
  const line = await prisma.payrollLine.findFirst({
    where: { payrollRunId: parsed.data.payrollRunId, employeeId: arrear.employeeId },
  });
  if (!line) return NextResponse.json({ error: 'Employee has no payroll line in this run' }, { status: 404 });

  // Find or create an ad-hoc salary component for manual arrears.
  const componentCode = arrear.amountType === 'EARNING' ? 'MANUAL_ARREAR_EARN' : 'MANUAL_ARREAR_DED';
  let component = await prisma.salaryComponent.findUnique({
    where: { companyId_code: { companyId: scope.companyId, code: componentCode } },
  });
  if (!component) {
    component = await prisma.salaryComponent.create({
      data: {
        companyId: scope.companyId,
        code: componentCode,
        name: arrear.amountType === 'EARNING' ? 'Manual Arrear (Earning)' : 'Manual Arrear (Deduction)',
        type: arrear.amountType === 'EARNING' ? 'earning' : 'deduction',
      },
    });
  }

  // Add as ad-hoc component to the payroll line.
  await prisma.payrollLineComponent.create({
    data: {
      payrollLineId: line.id,
      salaryComponentId: component.id,
      amount: arrear.amount,
      isAdhoc: true,
    },
  });

  // Recalculate the payroll line's ad-hoc totals.
  const adhocComponents = await prisma.payrollLineComponent.findMany({
    where: { payrollLineId: line.id, isAdhoc: true },
    include: { salaryComponent: { select: { type: true } } },
  });
  const adhocEarnings = adhocComponents
    .filter((c) => c.salaryComponent.type === 'earning')
    .reduce((sum, c) => sum + Number(c.amount), 0);
  const adhocDeductions = adhocComponents
    .filter((c) => c.salaryComponent.type === 'deduction')
    .reduce((sum, c) => sum + Number(c.amount), 0);

  await prisma.payrollLine.update({
    where: { id: line.id },
    data: {
      otherEarningsTotal: adhocEarnings,
      otherDeductionsTotal: adhocDeductions,
    },
  });

  // Mark the arrear as applied.
  const updated = await prisma.manualArrear.update({
    where: { id: arrearId },
    data: {
      status: 'APPLIED',
      appliedPayrollRunId: parsed.data.payrollRunId,
      appliedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
