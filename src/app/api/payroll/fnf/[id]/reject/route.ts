/**
 * POST /api/payroll/fnf/[id]/reject
 *   Rejects a calculated FnF settlement with reason.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

const bodySchema = z.object({
  rejectionReason: z.string().min(1).max(500),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.manage');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const settlementId = parseInt(id);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'rejectionReason is required' }, { status: 400 });
  }

  const settlement = await prisma.fnFSettlement.findFirst({
    where: { id: settlementId, companyId: scope.companyId },
  });
  if (!settlement) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
  if (settlement.status !== 'calculated') {
    return NextResponse.json({ error: `Settlement is already ${settlement.status}` }, { status: 409 });
  }

  const updated = await prisma.fnFSettlement.update({
    where: { id: settlementId },
    data: { status: 'rejected', rejectionReason: parsed.data.rejectionReason },
  });

  return NextResponse.json(updated);
}
