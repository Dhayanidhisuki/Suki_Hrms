/**
 * GET  /api/masters/tds-regime-config — this company's TDS regime config (or defaults).
 * PUT  /api/masters/tds-regime-config — upsert this company's TDS regime config.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { tdsRegimeConfigSchema } from '@/lib/validations/master';

const DEFAULTS = {
  defaultRegime: 'NEW',
  financialYearStart: 4,
  cessRate: 4,
  surchargeThreshold: 5000000,
  surchargeRate: 10,
  rebateUptoIncome: 500000,
  rebateAmount: 12500,
  standardDeduction: 50000,
  isActive: true,
};

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const record = await prisma.tdsRegimeConfig.findUnique({ where: { companyId: scope.companyId } });
  return NextResponse.json(record ?? DEFAULTS);
}

export async function PUT(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = tdsRegimeConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.tdsRegimeConfig.upsert({
    where: { companyId: scope.companyId },
    create: { ...parsed.data, companyId: scope.companyId },
    update: parsed.data,
  });

  return NextResponse.json(record);
}
