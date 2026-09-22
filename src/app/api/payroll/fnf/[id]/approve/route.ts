import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { logActivity } from '@/lib/activity-log';
import { fnfInclude } from '@/lib/fnf/include';
import { FNF_APPROVABLE, assertStatus, statusAfterHrApprove } from '@/lib/fnf/workflow';
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
  const blocked = assertStatus(settlement.status, FNF_APPROVABLE, 'approve');
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
  const config = await prisma.fullAndFinalConfig.findUnique({ where: { companyId: scope.companyId } });
  const sod = segregationConflict(settlement, userId, 'approve', config?.enforceSegregationOfDuties !== false);
  if (sod) return NextResponse.json({ error: sod }, { status: 403 });
  const next = statusAfterHrApprove(config?.approvalStages);

  const updated = await prisma.$transaction(async (tx) => {
    const rec = await tx.fnFSettlement.update({
      where: { id: settlementId },
      data: {
        status: next,
        approvedByUserId: Number.isFinite(userId) ? userId : null,
        approvedAt: new Date(),
        settlementDate: new Date(),
      },
      include: fnfInclude,
    });
    await logActivity(tx, {
      employeeId: settlement.employeeId,
      activityType: 'fnf_approved',
      module: 'fnf',
      performedByUserId: Number.isFinite(userId) ? userId : null,
      relatedRecordId: settlementId,
    });
    return rec;
  });

  try {
    const { archiveFnfStatement } = await import('@/lib/fnf-statement');
    await archiveFnfStatement(settlementId, { userId: Number.isFinite(userId) ? userId : null, source: 'system' });
  } catch (err) {
    console.error('[fnf] archive statement failed', err);
  }

  await emitFnfEvent(scope.companyId, next === 'finance_verified' ? 'FNF_FINANCE_VERIFIED' : 'FNF_APPROVED', updated, {
    linkPath: '/approvals/payroll/full-and-final',
  });
  return NextResponse.json(updated);
}
