import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { logActivity } from '@/lib/activity-log';
import { fnfInclude } from '@/lib/fnf/include';
import { FNF_SUBMITTABLE, assertStatus, submitStatus } from '@/lib/fnf/workflow';
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
  const blocked = assertStatus(settlement.status, FNF_SUBMITTABLE, 'submit');
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
  const config = await prisma.fullAndFinalConfig.findUnique({ where: { companyId: scope.companyId } });
  const next = submitStatus(config?.approvalStages);

  const updated = await prisma.$transaction(async (tx) => {
    const rec = await tx.fnFSettlement.update({
      where: { id: settlementId },
      data: {
        status: next,
        submittedByUserId: Number.isFinite(userId) ? userId : null,
        submittedAt: new Date(),
      },
      include: fnfInclude,
    });
    await logActivity(tx, {
      employeeId: settlement.employeeId,
      activityType: 'fnf_submitted',
      module: 'fnf',
      performedByUserId: Number.isFinite(userId) ? userId : null,
      relatedRecordId: settlementId,
    });
    return rec;
  });

  await emitFnfEvent(scope.companyId, next === 'pending_manager' ? 'FNF_SUBMITTED' : 'FNF_SUBMITTED', updated, {
    linkPath: '/approvals/payroll/full-and-final',
  });
  return NextResponse.json(updated);
}
