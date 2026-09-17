import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { logActivity } from '@/lib/activity-log';
import { fnfInclude } from '@/lib/fnf/include';
import { FNF_COMPLETABLE, assertStatus } from '@/lib/fnf/workflow';
import { emitFnfEvent } from '@/lib/fnf/notify';

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
  const blocked = assertStatus(settlement.status, FNF_COMPLETABLE, 'complete');
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

  const updated = await prisma.$transaction(async (tx) => {
    const rec = await tx.fnFSettlement.update({
      where: { id: settlementId },
      data: { status: 'completed', completedAt: new Date() },
      include: fnfInclude,
    });
    await logActivity(tx, {
      employeeId: settlement.employeeId,
      activityType: 'fnf_completed',
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

  await emitFnfEvent(scope.companyId, 'FNF_COMPLETED', updated, { linkPath: '/ess/fnf' });
  return NextResponse.json(updated);
}
