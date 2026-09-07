import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { employeeTypeSchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';

  const where = {
    deletedAt: null,
    ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.employeeType.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.employeeType.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const body = await request.json();
  const parsed = employeeTypeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.employeeType.findUnique({ where: { code: parsed.data.code } });
  if (existing && existing.deletedAt === null) return NextResponse.json({ error: 'Code already exists' }, { status: 409 });

  const record = await prisma.employeeType.create({ data: parsed.data });
  return NextResponse.json(record, { status: 201 });
}
