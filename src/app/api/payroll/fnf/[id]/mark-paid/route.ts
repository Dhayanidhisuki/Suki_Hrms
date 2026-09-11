/**
 * POST /api/payroll/fnf/[id]/mark-paid
 *   Marks an approved FnF settlement as paid.
 *   Body: { paymentReference?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

const bodySchema = z.object({
  paymentReference: z.string().max(100).optional(),
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

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  const settlement = await prisma.fnFSettlement.findFirst({
    where: { id: settlementId, companyId: scope.companyId },
  });
  if (!settlement) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
  if (settlement.status !== 'approved') {
    return NextResponse.json({ error: `Settlement must be approved first (current: ${settlement.status})` }, { status: 409 });
  }

  const updated = await prisma.fnFSettlement.update({
    where: { id: settlementId },
    data: {
      status: 'paid',
      paymentDate: new Date(),
      paymentReference: parsed.data.paymentReference ?? null,
    },
  });

  return NextResponse.json(updated);
}
