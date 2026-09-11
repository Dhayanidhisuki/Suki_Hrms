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
        employeeType: { select: { id: true, name: true } },
        salaryComponent: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.benefitRateByEmployeeType.count({ where }),
  ]);

  // Add employee-benefit counts per row
  const ids = data.map((d) => d.id);
  const counts = await prisma.employeeBenefit.groupBy({
    by: ['benefitRateId'],
    where: { benefitRateId: { in: ids }, isActive: true },
    _count: { employeeId: true },
  });
  const countMap = new Map(counts.map((c) => [c.benefitRateId, c._count.employeeId]));

  const dataWithCount = data.map((d) => ({
    ...d,
    employeeCount: countMap.get(d.id) ?? 0,
  }));

  return NextResponse.json({ data: dataWithCount, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const body = await request.json();
  const parsed = benefitRateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.benefitRateByEmployeeType.findFirst({
    where: { companyId: parsed.data.companyId, code: parsed.data.code },
  });
  if (existing) return NextResponse.json({ error: 'A benefit component with this code already exists for this company' }, { status: 409 });

  const record = await prisma.benefitRateByEmployeeType.create({
    data: parsed.data,
    include: {
      company: { select: { id: true, name: true } },
      employeeType: { select: { id: true, name: true } },
      salaryComponent: { select: { id: true, code: true, name: true } },
    },
  });
  return NextResponse.json(record, { status: 201 });
}
