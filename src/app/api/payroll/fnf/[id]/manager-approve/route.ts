import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { logActivity } from '@/lib/activity-log';
import { fnfInclude } from '@/lib/fnf/include';
import { FNF_MANAGER_APPROVABLE, assertStatus } from '@/lib/fnf/workflow';
import { emitFnfEvent } from '@/lib/fnf/notify';
import { segregationConflict } from '@/lib/fnf/segregation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const settlementId = Number((await params).id);
  const userId = Number(request.headers.get('x-user-id'));
  const settlement = await prisma.fnFSettlement.findFirst({
    where: { id: settlementId, companyId: scope.companyId },
  });
  if (!settlement) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
  const blocked = assertStatus(settlement.status, FNF_MANAGER_APPROVABLE, 'manager-approve');
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

  const [actor, subject] = await Promise.all([
    prisma.employee.findFirst({ where: { userId, companyId: scope.companyId, deletedAt: null }, select: { id: true } }),
    prisma.employee.findFirst({ where: { id: settlement.employeeId }, select: { reportingManagerId: true } }),
  ]);
  const manageErr = await checkSpecificPermission(request, 'payroll.processing.manage');
  const canManage = !manageErr;
  const isManager = Boolean(actor && subject?.reportingManagerId && actor.id === subject.reportingManagerId);
  if (!isManager && !canManage) {
    return NextResponse.json({ error: 'Only the reporting manager or payroll can manager-approve' }, { status: 403 });
  }

  const config = await prisma.fullAndFinalConfig.findUnique({ where: { companyId: scope.companyId } });
  const sod = segregationConflict(settlement, userId, 'manager-approve', config?.enforceSegregationOfDuties !== false);
  if (sod) return NextResponse.json({ error: sod }, { status: 403 });

  const updated = await prisma.$transaction(async (tx) => {
    const rec = await tx.fnFSettlement.update({
      where: { id: settlementId },
      data: {
        status: 'submitted',
        managerApprovedByUserId: Number.isFinite(userId) ? userId : null,
        managerApprovedAt: new Date(),
      },
      include: fnfInclude,
    });
    await logActivity(tx, {
      employeeId: settlement.employeeId,
      activityType: 'fnf_manager_approved',
      module: 'fnf',
      performedByUserId: Number.isFinite(userId) ? userId : null,
      relatedRecordId: settlementId,
    });
    return rec;
  });

  await emitFnfEvent(scope.companyId, 'FNF_MANAGER_APPROVED', updated, {
    linkPath: '/approvals/payroll/full-and-final',
  });
  return NextResponse.json(updated);
}
