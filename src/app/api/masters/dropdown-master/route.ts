import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { dropdownMasterSchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';
  const category = searchParams.get('category') ?? '';

  const where = {
    deletedAt: null,
    ...(search ? { OR: [{ label: { contains: search } }, { value: { contains: search } }] } : {}),
    ...(category ? { category } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.dropdownMaster.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] }),
    prisma.dropdownMaster.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const body = await request.json();
  const parsed = dropdownMasterSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.dropdownMaster.findFirst({
    where: { category: parsed.data.category, value: parsed.data.value, deletedAt: null },
  });
  if (existing) return NextResponse.json({ error: 'Value already exists in this category' }, { status: 409 });

  const record = await prisma.dropdownMaster.create({ data: parsed.data });
  return NextResponse.json(record, { status: 201 });
}
