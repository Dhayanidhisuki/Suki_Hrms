/**
 * GET  /api/masters/attendance-bonus-config — this company's attendance bonus config (or defaults).
 * PUT  /api/masters/attendance-bonus-config — upsert this company's attendance bonus config.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { attendanceBonusConfigSchema } from '@/lib/validations/master';

const DEFAULTS = {
  bonusAmount: 0,
  requiresZeroLop: true,
  requiresZeroLate: false,
  requiresZeroEarlyOut: false,
  prorateByPayableDays: false,
  minPayableDaysPercent: 100,
  isActive: true,
};

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const record = await prisma.attendanceBonusConfig.findUnique({ where: { companyId: scope.companyId } });
  return NextResponse.json(record ?? DEFAULTS);
}

export async function PUT(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = attendanceBonusConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.attendanceBonusConfig.upsert({
    where: { companyId: scope.companyId },
    create: { ...parsed.data, companyId: scope.companyId },
    update: parsed.data,
  });

  return NextResponse.json(record);
}
