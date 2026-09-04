/**
 * GET /api/bonus/records/[id] — full detail for one bonus record.
 * PUT /api/bonus/records/[id] — edit bonusPercent on a CALCULATED record
 *      (the per-employee rate override). Recomputes bonusAmount from the
 *      record's already-stored annualBonusWage — no need to re-touch
 *      Payroll/attendance data. Status stays CALCULATED; still needs
 *      Approve afterward.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { editBonusPercentSchema } from '@/lib/validations/bonus';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.bonus.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const record = await prisma.bonusRecord.findFirst({
    where: { id: Number(id), companyId: scope.companyId },
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
      appliedPayrollRun: { select: { id: true, year: true, month: true, status: true } },
    },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(record);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.bonus.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const parsed = editBonusPercentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.bonusRecord.findFirst({ where: { id: Number(id), companyId: scope.companyId } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (record.status !== 'CALCULATED') {
    return NextResponse.json({ error: `Cannot edit the bonus % on a record in ${record.status} status.` }, { status: 409 });
  }
  if (record.annualBonusWage === null) {
    return NextResponse.json({ error: 'This record has no wage base to recompute from — recalculate it first.' }, { status: 409 });
  }

  const bonusRate = await prisma.bonusRate.findFirst({ where: { companyId: scope.companyId, effectiveTo: null, isActive: true } });
  if (bonusRate && parsed.data.bonusPercent > Number(bonusRate.maxRatePercent)) {
    return NextResponse.json({ error: `Bonus % cannot exceed the configured maximum of ${bonusRate.maxRatePercent}%.` }, { status: 400 });
  }

  const bonusAmount = Math.round(Number(record.annualBonusWage) * (parsed.data.bonusPercent / 100));

  const updated = await prisma.bonusRecord.update({
    where: { id: record.id },
    data: { bonusPercent: parsed.data.bonusPercent, bonusAmount },
  });

  return NextResponse.json(updated);
}
