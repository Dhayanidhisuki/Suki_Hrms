/**
 * GET  /api/masters/mispunch-policy — this company's mis-punch policy (or defaults).
 * PUT  /api/masters/mispunch-policy — upsert this company's mis-punch policy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { mispunchPolicySchema } from '@/lib/validations/master';
import { DEFAULT_MAX_BACKDATE_DAYS, DEFAULT_MAX_REQUESTS_PER_MONTH } from '@/lib/mispunchPolicy';

const DEFAULTS = {
  maxBackdateDays: DEFAULT_MAX_BACKDATE_DAYS,
  maxRequestsPerMonth: DEFAULT_MAX_REQUESTS_PER_MONTH,
  isActive: true,
};

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const record = await prisma.mispunchPolicy.findUnique({ where: { companyId: scope.companyId } });
  return NextResponse.json(record ?? DEFAULTS);
}

export async function PUT(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = mispunchPolicySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.mispunchPolicy.upsert({
    where: { companyId: scope.companyId },
    create: { ...parsed.data, companyId: scope.companyId },
    update: parsed.data,
  });

  return NextResponse.json(record);
}
