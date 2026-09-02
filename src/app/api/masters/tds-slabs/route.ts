import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { tdsSlabSchema, validateSlabOverlap } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';

  const where = {
    ...(search ? { code: { contains: search } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.tDSSlab.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ code: 'asc' }, { effectiveFrom: 'desc' }],
    }),
    prisma.tDSSlab.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const body = await request.json();
  const parsed = tdsSlabSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  // App-layer overlap validation (Q5)
  const existing = await prisma.tDSSlab.findMany({ where: { code: parsed.data.code } });
  const overlapError = validateSlabOverlap(
    existing.map((r) => ({ id: r.id, effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo })),
    parsed.data.effectiveFrom,
    parsed.data.effectiveTo ?? null
  );
  if (overlapError) return NextResponse.json({ error: overlapError }, { status: 409 });

  const record = await prisma.tDSSlab.create({ data: parsed.data });
  return NextResponse.json(record, { status: 201 });
}
