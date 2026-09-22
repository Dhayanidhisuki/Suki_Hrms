import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { skillLevelSchema } from '@/lib/validations/learning';

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
  const search = searchParams.get('search') ?? '';

  const where = {
    companyId,
    deletedAt: null,
    ...(search ? { name: { contains: search } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.skillLevel.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { levelNumber: 'asc' },
    }),
    prisma.skillLevel.count({ where }),
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
  const parsed = skillLevelSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.skillLevel.findFirst({
    where: { companyId, levelNumber: parsed.data.levelNumber, deletedAt: null },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'Level number already exists for this company' },
      { status: 409 }
    );
  }

  const record = await prisma.skillLevel.create({
    data: { ...parsed.data, companyId },
  });

  return NextResponse.json(record, { status: 201 });
}
