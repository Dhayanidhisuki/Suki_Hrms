import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { designationSchema } from '@/lib/validations/master';
import { currentHeadcounts } from '@/lib/master-headcount';
import { nextSequentialCode } from '@/lib/master-code';

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

  const [data, total, headcounts] = await Promise.all([
    prisma.designation.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { reportsTo: { select: { id: true, name: true } } },
    }),
    prisma.designation.count({ where }),
    currentHeadcounts('designationId'),
  ]);

  return NextResponse.json({
    data: data.map((d) => ({ ...d, currentHeadcount: headcounts.get(d.id) ?? 0 })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const body = await request.json();
  const parsed = designationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  // Code is server-generated as DS001, DS002... — ignore whatever the client sent.
  const siblings = await prisma.designation.findMany({ select: { code: true } });
  const code = nextSequentialCode(siblings.map((s) => s.code), 'DS');

  if (parsed.data.reportsToId) {
    const target = await prisma.designation.findFirst({ where: { id: parsed.data.reportsToId, deletedAt: null }, select: { id: true } });
    if (!target) return NextResponse.json({ error: 'Reports To designation not found' }, { status: 400 });
  }

  const { code: _ignored, ...rest } = parsed.data;
  const record = await prisma.designation.create({ data: { ...rest, code }, include: { reportsTo: { select: { id: true, name: true } } } });
  return NextResponse.json(record, { status: 201 });
}
