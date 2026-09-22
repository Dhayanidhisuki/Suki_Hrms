/**
 * GET  /api/masters/full-and-final-config — this company's FnF config (or defaults).
 * PUT  /api/masters/full-and-final-config — upsert this company's FnF config.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { fullAndFinalConfigSchema } from '@/lib/validations/master';

const DEFAULTS = {
  includeUnpaidSalary: true,
  includeLeaveEncashment: true,
  includeGratuity: true,
  includeBonusProportion: true,
  includeNoticePay: true,
  noticePeriodDays: 30,
  includeLoanRecovery: true,
  includeAssetRecovery: true,
  salaryDivisor: 30,
  salaryDivisorMode: 'CALENDAR',
  noticeRateBasis: 'GROSS',
  includeTds: true,
  includePf: true,
  includeEsi: true,
  includePt: true,
  clearanceRequired: true,
  approvalStages: 'HR_FINANCE',
  enforceSegregationOfDuties: true,
  isActive: true,
};

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const record = await prisma.fullAndFinalConfig.findUnique({ where: { companyId: scope.companyId } });
  return NextResponse.json(record ?? DEFAULTS);
}

export async function PUT(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = fullAndFinalConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.fullAndFinalConfig.upsert({
    where: { companyId: scope.companyId },
    create: { ...parsed.data, companyId: scope.companyId },
    update: parsed.data,
  });

  return NextResponse.json(record);
}
