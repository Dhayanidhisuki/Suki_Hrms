/**
 * POST /api/payroll/loans/[id]/approve
 *   Approve a pending loan (HR action). Advances status to 'approved'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

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
  if (loan.status !== 'pending') {
    return NextResponse.json({ error: `Loan is already ${loan.status}` }, { status: 409 });
  }

  const updated = await prisma.loan.update({
    where: { id: loanId },
    data: { status: 'approved', approvedByUserId: userId, approvedAt: new Date() },
  });

  return NextResponse.json(updated);
}
