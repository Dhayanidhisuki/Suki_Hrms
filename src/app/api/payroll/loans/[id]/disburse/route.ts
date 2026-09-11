/**
 * POST /api/payroll/loans/[id]/disburse
 *   Disburse an approved loan — generates the installment schedule and
 *   activates the loan. Body: { disbursementReference?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { disburseLoan } from '@/lib/loanCalculation';

const bodySchema = z.object({
  disbursementReference: z.string().max(100).optional(),
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
  const userId = Number(request.headers.get('x-user-id'));

  const loan = await prisma.loan.findFirst({ where: { id: loanId, companyId: scope.companyId } });
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
  if (loan.status !== 'approved') {
    return NextResponse.json({ error: `Loan must be approved first (current: ${loan.status})` }, { status: 409 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await disburseLoan(loanId, userId);
    if (parsed.data.disbursementReference) {
      await prisma.loan.update({
        where: { id: loanId },
        data: { disbursementReference: parsed.data.disbursementReference },
      });
    }
    const updated = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Disbursement failed' }, { status: 500 });
  }
}
