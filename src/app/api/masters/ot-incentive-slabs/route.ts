/**
 * GET  /api/masters/ot-incentive-slabs — list this company's OT incentive slabs.
 * POST /api/masters/ot-incentive-slabs — create a new slab.
 *
 * Company-scoped effective-dated slab table (like ProfessionalTaxSlab).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { otIncentiveSlabSchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');

  const where = { companyId: scope.companyId };

  const [data, total] = await Promise.all([
    prisma.oTIncentiveSlab.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ effectiveFrom: 'desc' }],
    }),
    prisma.oTIncentiveSlab.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = otIncentiveSlabSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.oTIncentiveSlab.create({
    data: { ...parsed.data, companyId: scope.companyId },
  });

  return NextResponse.json(record, { status: 201 });
}
