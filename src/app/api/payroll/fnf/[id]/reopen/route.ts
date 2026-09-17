import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { logActivity } from '@/lib/activity-log';
import { fnfInclude } from '@/lib/fnf/include';
import { FNF_REOPENABLE, assertStatus } from '@/lib/fnf/workflow';

const bodySchema = z.object({
  remark: z.string().min(3).max(500),
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
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A reopen remark is required' }, { status: 400 });
  }

  const settlement = await prisma.fnFSettlement.findFirst({
    where: { id: settlementId, companyId: scope.companyId },
  });
  if (!settlement) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
  if (settlement.status === 'paid' || settlement.status === 'completed') {
    return NextResponse.json({ error: 'Paid or completed settlements cannot be reopened' }, { status: 409 });
  }
  const blocked = assertStatus(settlement.status, FNF_REOPENABLE, 'reopen');
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

  const updated = await prisma.$transaction(async (tx) => {
    const rec = await tx.fnFSettlement.update({
      where: { id: settlementId },
      data: {
        status: 'reopened',
        remarks: parsed.data.remark,
        approvedAt: null,
        approvedByUserId: null,
        submittedAt: null,
        submittedByUserId: null,
        financeVerifiedAt: null,
        financeVerifiedByUserId: null,
      },
      include: fnfInclude,
    });
    await logActivity(tx, {
      employeeId: settlement.employeeId,
      activityType: 'fnf_reopened',
      module: 'fnf',
      performedByUserId: Number.isFinite(userId) ? userId : null,
      relatedRecordId: settlementId,
      remarks: parsed.data.remark,
      oldValue: { status: settlement.status },
    });
    return rec;
  });

  return NextResponse.json(updated);
}
