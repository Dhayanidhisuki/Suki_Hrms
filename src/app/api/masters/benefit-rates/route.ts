import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { benefitRateSchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const companyId = searchParams.get('companyId');

  const where = { ...(companyId ? { companyId: Number(companyId) } : {}) };

  const [data, total] = await Promise.all([
    prisma.benefitRateByEmployeeType.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { id: true, name: true } },
        salaryComponent: { select: { id: true, code: true, name: true } },
        employeeType: { select: { id: true, name: true } },
      },
    }),
    prisma.benefitRateByEmployeeType.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const body = await request.json();
  const parsed = benefitRateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.benefitRateByEmployeeType.findUnique({
    where: {
      companyId_salaryComponentId_employeeTypeId: {
        companyId: parsed.data.companyId,
        salaryComponentId: parsed.data.salaryComponentId,
        employeeTypeId: parsed.data.employeeTypeId,
      },
    },
  });
  if (existing) return NextResponse.json({ error: 'A rate already exists for this component + employee type + company' }, { status: 409 });

  const record = await prisma.benefitRateByEmployeeType.create({ data: parsed.data });
  return NextResponse.json(record, { status: 201 });
}
