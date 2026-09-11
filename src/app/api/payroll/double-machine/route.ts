import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { doubleMachineEntrySchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const where: Record<string, unknown> = { employee: { companyId: scope.companyId, deletedAt: null } };
  if (status) where.status = status;
  const data = await prisma.doubleMachineEntry.findMany({
    where,
    include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
    orderBy: { date: 'desc' },
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.manage');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const parsed = doubleMachineEntrySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const employee = await prisma.employee.findFirst({ where: { id: parsed.data.employeeId, companyId: scope.companyId, deletedAt: null } });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  const calculatedIncentive = Number(parsed.data.workingHours) * Number(parsed.data.incentiveRate);
  const record = await prisma.doubleMachineEntry.create({
    data: { ...parsed.data, machine1: parsed.data.machine1 ?? null, machine2: parsed.data.machine2 ?? null, hrRemarks: parsed.data.hrRemarks ?? null, calculatedIncentive },
    include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } },
  });
  return NextResponse.json(record, { status: 201 });
}
