/**
 * GET  /api/masters/gratuity-policies — this company's GratuityPolicy history.
 * POST /api/masters/gratuity-policies — add a new version.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { gratuityPolicySchema } from '@/lib/validations/master';

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
    prisma.gratuityPolicy.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ effectiveFrom: 'desc' }],
    }),
    prisma.gratuityPolicy.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = gratuityPolicySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.gratuityPolicy.create({ data: { ...parsed.data, companyId: scope.companyId } });
  return NextResponse.json(record, { status: 201 });
}
