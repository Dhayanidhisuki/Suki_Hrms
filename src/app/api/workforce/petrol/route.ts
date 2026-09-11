import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { petrolAllowanceEntrySchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const where: Record<string, unknown> = { employee: { companyId: scope.companyId, deletedAt: null } };
  if (status) where.status = status;
  const data = await prisma.petrolAllowanceEntry.findMany({
    where,
    include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
    orderBy: { travelDate: 'desc' },
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const parsed = petrolAllowanceEntrySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  if (!(await findEmployeeInCompany(parsed.data.employeeId, scope.companyId))) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }
  const eligibleAmount = Number(parsed.data.km) * Number(parsed.data.ratePerKm);
  const travelDate = new Date(parsed.data.travelDate);
  const record = await prisma.petrolAllowanceEntry.create({
    data: {
      ...parsed.data,
      month: travelDate.getUTCMonth() + 1,
      year: travelDate.getUTCFullYear(),
      eligibleAmount,
      approvedAmount: eligibleAmount,
    },
    include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } },
  });
  return NextResponse.json(record, { status: 201 });
}
