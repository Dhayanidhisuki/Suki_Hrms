/**
 * GET  /api/employees/[id]/ctc/components — list this employee's CTC
 *      component rows (e.g. "Performance Incentive: 2135") on the current
 *      (effectiveTo = null) CTC revision.
 * POST /api/employees/[id]/ctc/components — upsert one row on the current
 *      CTC revision. Only SalaryComponents with grossTier = NON_PAYROLL or
 *      PAYROLL_HIDDEN may be attached here — this is the one attach point
 *      for both:
 *        - NON_PAYROLL: a CTC-quoted, display-only figure — payroll skips it
 *          entirely (payrollCalculation.ts's NON_PAYROLL skip).
 *        - PAYROLL_HIDDEN: the opposite — payroll DOES deduct it from Net
 *          Pay and it shows on Payroll Processing/Payslip, but it's
 *          deliberately kept off the Salary Details tab's own, separate
 *          component picker.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { z } from 'zod';

const upsertSchema = z.object({
  salaryComponentId: z.number().int().positive(),
  amount: z.number().nonnegative(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const employeeId = parseInt(id);

  const current = await prisma.employeeCtc.findFirst({ where: { employeeId, effectiveTo: null } });
  if (!current) return NextResponse.json({ data: [] });

  const data = await prisma.employeeCtcComponent.findMany({
    where: { employeeCtcId: current.id },
    include: { salaryComponent: { select: { id: true, code: true, name: true, grossTier: true } } },
    orderBy: { id: 'asc' },
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const employeeId = parseInt(id);

  const employee = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null }, select: { id: true, companyId: true } });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const current = await prisma.employeeCtc.findFirst({ where: { employeeId, effectiveTo: null } });
  if (!current) return NextResponse.json({ error: 'Fix this employee\'s CTC before adding CTC-only components.' }, { status: 409 });

  const parsed = upsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const component = await prisma.salaryComponent.findFirst({
    where: { id: parsed.data.salaryComponentId, companyId: employee.companyId, deletedAt: null },
  });
  if (!component) return NextResponse.json({ error: 'Component not found' }, { status: 404 });
  if (component.grossTier !== 'NON_PAYROLL' && component.grossTier !== 'PAYROLL_HIDDEN') {
    return NextResponse.json({ error: 'Only Non-Payroll or Payroll-Hidden components can be attached to CTC here.' }, { status: 400 });
  }

  const row = await prisma.employeeCtcComponent.upsert({
    where: { employeeCtcId_salaryComponentId: { employeeCtcId: current.id, salaryComponentId: component.id } },
    update: { amount: parsed.data.amount },
    create: { employeeCtcId: current.id, salaryComponentId: component.id, amount: parsed.data.amount },
  });
  return NextResponse.json(row, { status: 201 });
}
