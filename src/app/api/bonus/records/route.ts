/**
 * GET  /api/bonus/records?acYear=2026&unitId=&status=  — list this
 *      company's bonus records for the given accounting year.
 * POST /api/bonus/records   — batch-calculate. Body: { acYear }. Matches
 *      Payroll's POST /api/payroll/runs/[id]/calculate shape.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { calculateBonusSchema } from '@/lib/validations/bonus';
import { calculateBonusRecords } from '@/lib/bonusCalculation';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.bonus.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const acYear = searchParams.get('acYear') ? Number(searchParams.get('acYear')) : undefined;
  const status = searchParams.get('status');
  const unitId = searchParams.get('unitId') ? Number(searchParams.get('unitId')) : undefined;

  const data = await prisma.bonusRecord.findMany({
    where: {
      companyId: scope.companyId,
      ...(acYear ? { acYear } : {}),
      ...(status ? { status } : {}),
      ...(unitId ? { employee: { jobInfos: { some: { effectiveTo: null, unitId } } } } : {}),
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          jobInfos: {
            where: { effectiveTo: null },
            take: 1,
            select: { department: { select: { name: true } }, designation: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: [{ acYear: 'desc' }, { employee: { employeeCode: 'asc' } }],
  });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.bonus.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = calculateBonusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await calculateBonusRecords(scope.companyId, parsed.data.acYear);
    return NextResponse.json({
      message: `Calculated ${result.calculated} eligible, ${result.notEligible} not eligible, ${result.skipped} already finalized (skipped)`,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('No active BonusRate')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    throw err;
  }
}
