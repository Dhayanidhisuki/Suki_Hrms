/**
 * GET  /api/masters/bonus-rates — this company's BonusRate history
 *      (versioned like PfRate/EsiRate — migration 000013 made it
 *      company-scoped; previously one global row seeded only by a script).
 * POST /api/masters/bonus-rates — add a new version. Overlap is not
 *      auto-validated (unlike PfRate/EsiRate's validateSlabOverlap) since
 *      BonusRate is looked up by "current" (effectiveTo: null) only, not by
 *      date-range lookup — same reasoning already applied to BonusRate
 *      itself in bonusCalculation.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { bonusRateSchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';

  const where = { companyId: scope.companyId, ...(search ? { code: { contains: search } } : {}) };

  const [data, total] = await Promise.all([
    prisma.bonusRate.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ effectiveFrom: 'desc' }],
    }),
    prisma.bonusRate.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = bonusRateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.bonusRate.create({ data: { ...parsed.data, companyId: scope.companyId } });
  return NextResponse.json(record, { status: 201 });
}
