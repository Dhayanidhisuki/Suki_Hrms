import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { competencySchema } from '@/lib/validations/learning';
import { nextSequentialCode } from '@/lib/master-code';

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
  const category = searchParams.get('category') ?? '';

  const where = {
    companyId,
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { code: { contains: search } },
            { category: { contains: search } },
          ],
        }
      : {}),
    ...(category ? { category } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.competency.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.competency.count({ where }),
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
  const parsed = competencySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Code is always server-generated — ignore whatever the client sent.
  // Scans all rows for this company, deleted included, so a code is never
  // reused after a soft delete.
  const existing = await prisma.competency.findMany({
    where: { companyId },
    select: { code: true },
  });
  const code = nextSequentialCode(
    existing.map((c) => c.code).filter((c): c is string => c != null),
    'CMP'
  );

  const record = await prisma.competency.create({
    data: { ...parsed.data, code, companyId },
  });

  return NextResponse.json(record, { status: 201 });
}
