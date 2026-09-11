/**
 * GET /api/payroll/loans/[id]/statement
 *   Returns the loan statement — loan details + installment schedule with
 *   deduction status. Used by the loan statement page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const loanId = parseInt(id);

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, companyId: scope.companyId },
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      loanType: { select: { id: true, code: true, name: true } },
      installments: { orderBy: { installmentNumber: 'asc' } },
    },
  });
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  return NextResponse.json(loan);
}
