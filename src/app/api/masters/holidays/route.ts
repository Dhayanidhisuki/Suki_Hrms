import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { holidayMasterSchema } from '@/lib/validations/master';

// companyId comes from the session, never the body or query string.
const holidayInputSchema = holidayMasterSchema.omit({ companyId: true });

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';

  const where = {
    companyId: scope.companyId,
    deletedAt: null,
    ...(search ? { name: { contains: search } } : {}),
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
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = holidayInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const data = { ...parsed.data, companyId: scope.companyId };

  const existing = await prisma.holidayMaster.findUnique({
    where: { companyId_date: { companyId: scope.companyId, date: data.date } },
  });
  if (existing && existing.deletedAt === null) {
    return NextResponse.json({ error: 'A holiday already exists on this date' }, { status: 409 });
  }
  // The unique key (companyId, date) ignores soft-delete, so re-adding a
  // deleted date must restore that row rather than insert a duplicate.
  if (existing) {
    const restored = await prisma.holidayMaster.update({ where: { id: existing.id }, data: { ...data, deletedAt: null } });
    return NextResponse.json(restored, { status: 200 });
  }

  const record = await prisma.holidayMaster.create({ data });
  return NextResponse.json(record, { status: 201 });
}
