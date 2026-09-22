import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { logActivity } from '@/lib/activity-log';
import { fnfInclude } from '@/lib/fnf/include';
import { FNF_FINANCE_VERIFIABLE, assertStatus } from '@/lib/fnf/workflow';
import { emitFnfEvent } from '@/lib/fnf/notify';
import { segregationConflict } from '@/lib/fnf/segregation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.manage');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const settlementId = parseInt((await params).id);
  const userId = Number(request.headers.get('x-user-id'));
  const settlement = await prisma.fnFSettlement.findFirst({
    where: { id: settlementId, companyId: scope.companyId },
  });
  if (!settlement) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
  const config = await prisma.fullAndFinalConfig.findUnique({ where: { companyId: scope.companyId } });
  if (config?.approvalStages === 'HR') {
    return NextResponse.json({ error: 'Finance verification is not required for HR-only approval' }, { status: 409 });
  }
  const blocked = assertStatus(settlement.status, FNF_FINANCE_VERIFIABLE, 'finance-verify');
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
  const sod = segregationConflict(settlement, userId, 'finance-verify', config?.enforceSegregationOfDuties !== false);
  if (sod) return NextResponse.json({ error: sod }, { status: 403 });

  const updated = await prisma.$transaction(async (tx) => {
    const rec = await tx.fnFSettlement.update({
      where: { id: settlementId },
      data: {
        status: 'finance_verified',
        financeVerifiedByUserId: Number.isFinite(userId) ? userId : null,
        financeVerifiedAt: new Date(),
      },
      include: fnfInclude,
    });
    await logActivity(tx, {
      employeeId: settlement.employeeId,
      activityType: 'fnf_finance_verified',
      module: 'fnf',
      performedByUserId: Number.isFinite(userId) ? userId : null,
      relatedRecordId: settlementId,
    });
    return rec;
  });

  await emitFnfEvent(scope.companyId, 'FNF_FINANCE_VERIFIED', updated, {
    linkPath: '/payroll/processing/full-and-final',
  });
  return NextResponse.json(updated);
}
