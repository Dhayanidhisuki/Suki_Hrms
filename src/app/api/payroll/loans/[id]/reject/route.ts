/**
 * POST /api/payroll/loans/[id]/reject
 *   Reject a pending loan with reason.
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
  const loanId = parseInt(id);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'rejectionReason is required' }, { status: 400 });
  }

  const loan = await prisma.loan.findFirst({ where: { id: loanId, companyId: scope.companyId } });
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
  if (loan.status !== 'pending') {
    return NextResponse.json({ error: `Loan is already ${loan.status}` }, { status: 409 });
  }

  const updated = await prisma.loan.update({
    where: { id: loanId },
    data: { status: 'rejected', rejectionReason: parsed.data.rejectionReason },
  });

  return NextResponse.json(updated);
}
