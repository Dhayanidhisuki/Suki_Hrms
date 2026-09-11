/**
 * GET  /api/masters/comp-off-policy — this company's comp-off policy (or defaults).
 * PUT  /api/masters/comp-off-policy — upsert this company's comp-off policy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { compOffPolicySchema } from '@/lib/validations/master';

const DEFAULTS = {
  minQualifyingHours: 4,
  qualifyingDayTypes: 'WEEKLY_OFF,HOLIDAY',
  requiresApproval: true,
  expiryMonths: 3,
  allowEncashment: false,
  encashmentRatePerDay: null,
  autoCreditOnApproval: true,
  isActive: true,
};

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const record = await prisma.compOffPolicy.findUnique({ where: { companyId: scope.companyId } });
  return NextResponse.json(record ?? DEFAULTS);
}

export async function PUT(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = compOffPolicySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.compOffPolicy.upsert({
    where: { companyId: scope.companyId },
    create: { ...parsed.data, companyId: scope.companyId },
    update: parsed.data,
  });

  return NextResponse.json(record);
}
