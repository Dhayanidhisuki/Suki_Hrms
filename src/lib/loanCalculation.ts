/**
 * Loan calculation and installment schedule generation.
 *
 * EMI formula (reducing balance):
 *   EMI = P × r × (1+r)^n / ((1+r)^n - 1)
 * where:
 *   P = principal
 *   r = monthly interest rate = annualRate / 12 / 100
 *   n = tenure months
 *
 * For interest-free loans (r=0), EMI = P / n (simple division).
 *
 * Each installment splits the EMI into principal and interest components
 * using the reducing balance method:
 *   interest = outstandingBalance × r
 *   principal = EMI - interest
 */

import { prisma } from '@/lib/prisma';

export interface InstallmentPlan {
  installmentNumber: number;
  dueDate: Date;
  principalComponent: number;
  interestComponent: number;
  totalAmount: number;
}

/**
 * Generate the installment schedule for a loan.
 */
export function generateInstallmentSchedule(
  principal: number,
  annualInterestRate: number,
  tenureMonths: number,
  disbursementDate: Date,
  firstDeductionMonth?: number | null,
  firstDeductionYear?: number | null
): InstallmentPlan[] {
  const monthlyRate = annualInterestRate / 12 / 100;
  const emi = monthlyRate > 0
    ? (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1)
    : principal / tenureMonths;

  // Determine first deduction date.
  let firstDate: Date;
  if (firstDeductionMonth && firstDeductionYear) {
    firstDate = new Date(Date.UTC(firstDeductionYear, firstDeductionMonth - 1, 1));
  } else {
    // Default: month after disbursement.
    firstDate = new Date(Date.UTC(
      disbursementDate.getUTCFullYear(),
      disbursementDate.getUTCMonth() + 1,
      1
    ));
  }

  const schedule: InstallmentPlan[] = [];
  let outstanding = principal;

  for (let i = 1; i <= tenureMonths; i++) {
    const interest = outstanding * monthlyRate;
    const principalComponent = Math.min(emi - interest, outstanding);
    const totalAmount = principalComponent + interest;
    const dueDate = new Date(Date.UTC(
      firstDate.getUTCFullYear(),
      firstDate.getUTCMonth() + (i - 1),
      1
    ));

    schedule.push({
      installmentNumber: i,
      dueDate,
      principalComponent: Number(principalComponent.toFixed(2)),
      interestComponent: Number(interest.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
    });

    outstanding -= principalComponent;
  }

  return schedule;
}

/**
 * Disburse a loan — generates the installment schedule and updates the
 * loan status to 'active'. Returns the generated installments.
 */
export async function disburseLoan(loanId: number, userId: number): Promise<void> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { installments: true },
  });
  if (!loan) throw new Error(`Loan ${loanId} not found`);
  if (loan.status !== 'approved') {
    throw new Error(`Loan ${loanId} is not approved (status: ${loan.status})`);
  }
  if (loan.installments.length > 0) {
    throw new Error(`Loan ${loanId} already has installments`);
  }

  const schedule = generateInstallmentSchedule(
    Number(loan.principal),
    Number(loan.interestRate),
    loan.tenureMonths,
    loan.disbursementDate,
    loan.firstDeductionMonth,
    loan.firstDeductionYear
  );

  await prisma.$transaction(async (tx) => {
    // Create all installments.
    await tx.loanInstallment.createMany({
      data: schedule.map((s) => ({
        loanId,
        installmentNumber: s.installmentNumber,
        dueDate: s.dueDate,
        principalComponent: s.principalComponent,
        interestComponent: s.interestComponent,
        totalAmount: s.totalAmount,
        status: 'pending',
      })),
    });

    // Update loan status.
    await tx.loan.update({
      where: { id: loanId },
      data: {
        status: 'active',
        disbursedByUserId: userId,
        disbursedAt: new Date(),
        outstandingBalance: loan.principal,
      },
    });
  });
}

/**
 * Deduct the next pending installment for a loan during payroll processing.
 * Called by the payroll engine for each active loan of an employee.
 * Returns the deduction amount (0 if no pending installment or loan not active).
 */
export async function deductNextInstallment(
  loanId: number,
  payrollRunId: number
): Promise<{ principal: number; interest: number; total: number; installmentId: number } | null> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      installments: {
        where: { status: 'pending' },
        orderBy: { installmentNumber: 'asc' },
        take: 1,
      },
    },
  });
  if (!loan || loan.status !== 'active' || loan.installments.length === 0) {
    return null;
  }

  const installment = loan.installments[0];
  const principal = Number(installment.principalComponent);
  const interest = Number(installment.interestComponent);
  const total = Number(installment.totalAmount);

  await prisma.$transaction(async (tx) => {
    // Mark installment as deducted.
    await tx.loanInstallment.update({
      where: { id: installment.id },
      data: {
        status: 'deducted',
        payrollRunId,
        deductedAt: new Date(),
      },
    });

    // Update loan running totals.
    const newPrincipalPaid = Number(loan.principalPaid) + principal;
    const newInterestPaid = Number(loan.interestPaid) + interest;
    const newOutstanding = Math.max(0, Number(loan.outstandingBalance) - principal);
    const newInstallmentsPaid = loan.installmentsPaid + 1;
    const isClosed = newOutstanding <= 0 || newInstallmentsPaid >= loan.tenureMonths;

    await tx.loan.update({
      where: { id: loanId },
      data: {
        principalPaid: newPrincipalPaid,
        interestPaid: newInterestPaid,
        outstandingBalance: newOutstanding,
        installmentsPaid: newInstallmentsPaid,
        status: isClosed ? 'closed' : 'active',
        closedAt: isClosed ? new Date() : null,
        closureReason: isClosed ? 'All installments deducted' : null,
      },
    });
  });

  return { principal, interest, total, installmentId: installment.id };
}
