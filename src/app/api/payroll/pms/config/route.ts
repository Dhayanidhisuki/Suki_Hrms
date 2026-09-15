/**
 * GET  /api/payroll/pms/config?financialYear=2026-27
 * POST /api/payroll/pms/config — HR/Admin only; upsert the company-level
 *        configuration for a financial year.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { getPmsConfig } from '@/lib/pmsIncentive';
import { pmsIncentiveConfigSchema } from '@/lib/validations/workforce';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.pms.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const financialYear = searchParams.get('financialYear') ?? undefined;
  const [config, salaryComponents] = await Promise.all([
    getPmsConfig(scope.companyId, financialYear),
    prisma.salaryComponent.findMany({
      where: { companyId: scope.companyId, isActive: true, deletedAt: null },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return NextResponse.json({ data: { config, salaryComponents } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.pms.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = pmsIncentiveConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.salaryComponentId) {
    const component = await prisma.salaryComponent.findFirst({
      where: { id: parsed.data.salaryComponentId, companyId: scope.companyId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!component) {
      return NextResponse.json({ error: 'Selected salary component is not valid for this company.' }, { status: 400 });
    }
  }

  const userId = Number(request.headers.get('x-user-id')) || null;
  const config = await prisma.pmsIncentiveConfig.upsert({
    where: {
      companyId_financialYear: {
        companyId: scope.companyId,
        financialYear: parsed.data.financialYear,
      },
    },
    create: {
      companyId: scope.companyId,
      financialYear: parsed.data.financialYear,
      effectiveFrom: parsed.data.effectiveFrom,
      effectiveTo: parsed.data.effectiveTo,
      calculationBasis: parsed.data.calculationBasis,
      salaryComponentId: parsed.data.salaryComponentId ?? null,
      incentiveType: parsed.data.incentiveType,
      companyPercent: parsed.data.companyPercent,
      companyValue: parsed.data.companyValue ?? null,
      targetIncentiveAmount: parsed.data.targetIncentiveAmount ?? null,
      remarks: parsed.data.remarks ?? null,
      status: parsed.data.status,
      createdByUserId: userId,
      updatedByUserId: userId,
    },
    update: {
      effectiveFrom: parsed.data.effectiveFrom,
      effectiveTo: parsed.data.effectiveTo,
      calculationBasis: parsed.data.calculationBasis,
      salaryComponentId: parsed.data.salaryComponentId ?? null,
      incentiveType: parsed.data.incentiveType,
      companyPercent: parsed.data.companyPercent,
      companyValue: parsed.data.companyValue ?? null,
      targetIncentiveAmount: parsed.data.targetIncentiveAmount ?? null,
      remarks: parsed.data.remarks ?? null,
      status: parsed.data.status,
      updatedByUserId: userId,
    },
  });

  return NextResponse.json(config);
}
