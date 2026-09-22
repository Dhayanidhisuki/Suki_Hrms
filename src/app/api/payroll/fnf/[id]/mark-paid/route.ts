import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { logActivity } from '@/lib/activity-log';
import { fnfInclude } from '@/lib/fnf/include';
import { assertStatus, payableStatuses } from '@/lib/fnf/workflow';
import { buildJournal } from '@/lib/fnfCalculation';
import { emitFnfEvent } from '@/lib/fnf/notify';

const bodySchema = z.object({
  paymentReference: z.string().max(100).optional(),
});

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
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  const settlement = await prisma.fnFSettlement.findFirst({
    where: { id: settlementId, companyId: scope.companyId },
  });
  if (!settlement) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
  const config = await prisma.fullAndFinalConfig.findUnique({ where: { companyId: scope.companyId } });
  const allowed = payableStatuses(config?.approvalStages);
  const blocked = assertStatus(settlement.status, allowed, 'mark paid');
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

  const journal = buildJournal(settlement);

  const updated = await prisma.$transaction(async (tx) => {
    const rec = await tx.fnFSettlement.update({
      where: { id: settlementId },
      data: {
        status: 'paid',
        paymentDate: new Date(),
        paymentReference: parsed.data.paymentReference ?? null,
        journalJson: JSON.stringify(journal),
      },
      include: fnfInclude,
    });
    await logActivity(tx, {
      employeeId: settlement.employeeId,
      activityType: 'fnf_paid',
      module: 'fnf',
      performedByUserId: Number.isFinite(userId) ? userId : null,
      relatedRecordId: settlementId,
      newValue: { paymentReference: parsed.data.paymentReference },
    });
    return rec;
  });

  await emitFnfEvent(scope.companyId, 'FNF_PAID', updated, { linkPath: '/ess/fnf' });
  return NextResponse.json(updated);
}
