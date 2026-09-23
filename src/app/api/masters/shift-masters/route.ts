import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { shiftMasterSchema } from '@/lib/validations/master';
import { nextSequentialCode } from '@/lib/master-code';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';
  // 'active' | 'inactive'; anything else (including absent) means no filter,
  // so an existing caller that never sends it keeps seeing every row.
  const status = searchParams.get('status');

  const where = {
    deletedAt: null,
    ...(status === 'active' ? { isActive: true } : status === 'inactive' ? { isActive: false } : {}),
    ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.shiftMaster.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.shiftMaster.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const body = await request.json();
  const parsed = shiftMasterSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.shiftMaster.findUnique({ where: { code: parsed.data.code ?? '' } });
  if (existing && existing.deletedAt === null) return NextResponse.json({ error: 'Code already exists' }, { status: 409 });

  // Code is server-generated as SHF001, SHF002... — ignore whatever the client sent.
  const siblings = await prisma.shiftMaster.findMany({ select: { code: true } });
  const code = nextSequentialCode(siblings.map((s) => s.code), 'SHF');

  const { code: _ignored, ...rest } = parsed.data;
  const record = await prisma.shiftMaster.create({ data: { ...rest, code } });
  return NextResponse.json(record, { status: 201 });
}
