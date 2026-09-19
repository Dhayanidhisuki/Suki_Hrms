/**
 * GET  /api/workforce/my-loans
 *   The logged-in employee's own loans (all statuses), newest first.
 * POST /api/workforce/my-loans
 *   Employee applies for a loan/advance — creates a Loan with status
 *   'pending', awaiting Reporting Manager / HR approval (see
 *   /api/payroll/loans/[id]/approve). Interest-free (self-service loans do
 *   not expose an interest rate — HR can adjust that only via the admin
 *   loan API before disbursement). Installment amount is computed from the
 *   same EMI formula the admin side uses, not taken from client input.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { getCompanyId } from '@/lib/companyScope';
import { generateInstallmentSchedule } from '@/lib/loanCalculation';
import { z } from 'zod';

const applyLoanSchema = z.object({
  loanTypeId: z.coerce.number().int().positive(),
  principal: z.coerce.number().min(0.01),
  tenureMonths: z.coerce.number().int().min(1),
  remarks: z.string().max(500).optional().nullable(),
});

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const loans = await prisma.loan.findMany({
    where: { employeeId: ownEmployeeId },
    include: {
      loanType: { select: { code: true, name: true } },
      installments: { orderBy: { installmentNumber: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data: loans });
}

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = applyLoanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { loanTypeId, principal, tenureMonths, remarks } = parsed.data;

  const loanType = await prisma.loanType.findFirst({ where: { id: loanTypeId, deletedAt: null } });
  if (!loanType || !loanType.isActive) {
    return NextResponse.json({ error: 'Invalid or inactive loan type' }, { status: 400 });
  }
  if (loanType.minAmount && principal < Number(loanType.minAmount)) {
    return NextResponse.json({ error: `Amount below minimum (${loanType.minAmount}) for this loan type` }, { status: 400 });
  }
  if (loanType.maxAmount && principal > Number(loanType.maxAmount)) {
    return NextResponse.json({ error: `Amount exceeds maximum (${loanType.maxAmount}) for this loan type` }, { status: 400 });
  }

  const existingOpen = await prisma.loan.findFirst({
    where: { employeeId: ownEmployeeId, loanTypeId, status: { in: ['pending', 'approved', 'active'] } },
  });
  if (existingOpen) {
    return NextResponse.json({ error: 'You already have an open request/loan of this type' }, { status: 409 });
  }

  const employee = await prisma.employee.findFirst({ where: { id: ownEmployeeId }, select: { employeeCode: true } });
  const disbursementDate = new Date();
  const schedule = generateInstallmentSchedule(principal, 0, tenureMonths, disbursementDate);
  const installmentAmount = schedule[0]?.totalAmount ?? Number((principal / tenureMonths).toFixed(2));
  const code = `LN-${employee?.employeeCode ?? ownEmployeeId}-${Date.now().toString(36).toUpperCase()}`;

  const loan = await prisma.loan.create({
    data: {
      companyId: scope.companyId,
      employeeId: ownEmployeeId,
      loanTypeId,
      code,
      principal,
      interestRate: 0,
      tenureMonths,
      installmentAmount,
      disbursementDate,
      outstandingBalance: principal,
      status: 'pending',
      requestedByUserId: userId,
      remarks: remarks ?? null,
    },
    include: { loanType: { select: { code: true, name: true } } },
  });

  return NextResponse.json(loan, { status: 201 });
}
