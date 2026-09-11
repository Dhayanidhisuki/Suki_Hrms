/**
 * GET  /api/masters/deduction-rates — this company's Deduction Rates
 *      catalog (paginated, versioned Pattern E rows), incl. Loss-of-Pay
 *      rows (isLop).
 * POST /api/masters/deduction-rates — create a rate; app-layer overlap
 *      validation scoped to this company + code (Q5 pattern).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { deductionRateSchema, validateSlabOverlap } from '@/lib/validations/master';

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
    ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.deductionRate.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ code: 'asc' }, { effectiveFrom: 'desc' }],
    }),
    prisma.deductionRate.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = deductionRateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.deductionRate.findMany({ where: { companyId: scope.companyId, code: parsed.data.code } });
  const overlapError = validateSlabOverlap(
    existing.map((r) => ({ id: r.id, effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo })),
    parsed.data.effectiveFrom,
    parsed.data.effectiveTo ?? null
  );
  if (overlapError) return NextResponse.json({ error: overlapError }, { status: 409 });

  const record = await prisma.deductionRate.create({ data: { ...parsed.data, companyId: scope.companyId } });
  return NextResponse.json(record, { status: 201 });
}
