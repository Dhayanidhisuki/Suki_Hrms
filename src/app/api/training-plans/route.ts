import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { trainingPlanSchema } from '@/lib/validations/learning';

export async function GET(request: NextRequest) {
  if (!request.headers.get('x-role-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const year = searchParams.get('year');
  const status = searchParams.get('status');
  const departmentId = searchParams.get('departmentId');

  const where: Record<string, unknown> = { companyId, deletedAt: null };
  if (year) where.year = year;
  if (status) where.status = status;
  if (departmentId) where.departmentId = parseInt(departmentId);

  const [data, total] = await Promise.all([
    prisma.trainingPlan.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.trainingPlan.count({ where }),
  ]);

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  if (!request.headers.get('x-role-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const body = await request.json();
  const parsed = trainingPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const record = await prisma.trainingPlan.create({
    data: { ...parsed.data, companyId, status: parsed.data.status.toUpperCase() },
  });

  return NextResponse.json(record, { status: 201 });
}
