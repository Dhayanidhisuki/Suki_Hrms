import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { logActivity } from '@/lib/activity-log';
import { fnfInclude } from '@/lib/fnf/include';
import { FNF_HOLDABLE, assertStatus } from '@/lib/fnf/workflow';

const bodySchema = z.object({
  reason: z.string().min(3).max(500),
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
    return NextResponse.json({ error: 'A hold reason is required' }, { status: 400 });
  }

  const settlement = await prisma.fnFSettlement.findFirst({
    where: { id: settlementId, companyId: scope.companyId },
  });
  if (!settlement) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
  const blocked = assertStatus(settlement.status, FNF_HOLDABLE, 'hold');
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

  const updated = await prisma.$transaction(async (tx) => {
    const rec = await tx.fnFSettlement.update({
      where: { id: settlementId },
      data: { status: 'on_hold', holdReason: parsed.data.reason },
      include: fnfInclude,
    });
    await logActivity(tx, {
      employeeId: settlement.employeeId,
      activityType: 'fnf_on_hold',
      module: 'fnf',
      performedByUserId: Number.isFinite(userId) ? userId : null,
      relatedRecordId: settlementId,
      remarks: parsed.data.reason,
    });
    return rec;
  });

  return NextResponse.json(updated);
}
