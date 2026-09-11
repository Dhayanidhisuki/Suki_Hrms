import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { canteenTokenSchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? String(new Date().getUTCFullYear()));
  const month = parseInt(searchParams.get('month') ?? String(new Date().getUTCMonth() + 1));
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const data = await prisma.canteenToken.findMany({
    where: { date: { gte: monthStart, lt: monthEnd }, employee: { companyId: scope.companyId, deletedAt: null } },
    include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
    orderBy: { date: 'desc' },
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const parsed = canteenTokenSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  if (!(await findEmployeeInCompany(parsed.data.employeeId, scope.companyId))) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }
  const employeeContribution = Number(parsed.data.tokensUsed) * Number(parsed.data.ratePerToken);
  const record = await prisma.canteenToken.create({
    data: { ...parsed.data, employeeContribution },
    include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } },
  });
  return NextResponse.json(record, { status: 201 });
}
