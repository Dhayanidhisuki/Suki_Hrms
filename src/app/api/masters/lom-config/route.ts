/**
 * GET  /api/masters/lom-config — this company's LOM config (or defaults).
 * PUT  /api/masters/lom-config — upsert this company's LOM config.
 *
 * Company-scoped single-row config (companyId @unique). GET returns the
 * row when it exists, otherwise returns the schema defaults so the admin
 * page always has a value to display/edit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { lomConfigSchema } from '@/lib/validations/master';

const DEFAULTS = {
  calculationBasis: 'GROSS',
  multiplier: 1,
  shiftDurationSource: 'FIXED_8',
  payrollDaysDenominator: 'CALENDAR',
  graceMinutesExempt: 0,
  dailyLomCap: null,
  isActive: true,
};

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const record = await prisma.lomConfig.findUnique({ where: { companyId: scope.companyId } });
  return NextResponse.json(record ?? DEFAULTS);
}

export async function PUT(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = lomConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.lomConfig.upsert({
    where: { companyId: scope.companyId },
    create: { ...parsed.data, companyId: scope.companyId },
    update: parsed.data,
  });

  return NextResponse.json(record);
}
