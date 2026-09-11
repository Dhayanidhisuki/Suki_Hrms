/**
 * GET  /api/masters/lwf-rates — list this company's LWF rates by state.
 * POST /api/masters/lwf-rates — create a new LWF rate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { lwfRateSchema } from '@/lib/validations/master';

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
    prisma.lwfRate.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ state: 'asc' }, { effectiveFrom: 'desc' }],
    }),
    prisma.lwfRate.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = lwfRateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.lwfRate.create({
    data: { ...parsed.data, companyId: scope.companyId },
  });

  return NextResponse.json(record, { status: 201 });
}
