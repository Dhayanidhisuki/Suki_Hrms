import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { holidayMasterSchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';
  const companyId = searchParams.get('companyId');

  const where = {
    deletedAt: null,
    ...(search ? { name: { contains: search } } : {}),
    ...(companyId ? { companyId: Number(companyId) } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.holidayMaster.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { date: 'asc' },
      include: { company: { select: { id: true, name: true } } },
    }),
    prisma.holidayMaster.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const body = await request.json();
  const parsed = holidayMasterSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.holidayMaster.findUnique({
    where: { companyId_date: { companyId: parsed.data.companyId, date: parsed.data.date } },
  });
  if (existing && existing.deletedAt === null) return NextResponse.json({ error: 'A holiday already exists on this date for this company' }, { status: 409 });

  const record = await prisma.holidayMaster.create({ data: parsed.data });
  return NextResponse.json(record, { status: 201 });
}
