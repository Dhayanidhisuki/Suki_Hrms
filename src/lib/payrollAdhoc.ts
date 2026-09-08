/**
 * Shared core of POST /api/payroll/runs/[id]/lines/[lineId]/adhoc — pulled
 * out so the new benefit-rate auto-apply and bulk ad-hoc upload can reuse
 * the exact same PayrollLineComponent + running-total update logic instead
 * of re-deriving it. See that route's own header comment for why this is a
 * delta update, not a full re-sum.
 */

import { prisma } from './prisma';

export async function applyAdhocLine(payrollLineId: number, salaryComponentId: number, rawAmount: number) {
  const component = await prisma.salaryComponent.findUnique({ where: { id: salaryComponentId } });
  if (!component || (component.type !== 'earning' && component.type !== 'deduction')) {
    throw new Error('Invalid or non-earning/deduction salary component');
  }

  const amount = Math.round(Math.abs(rawAmount));
  const isEarning = component.type === 'earning';

  const [, updated] = await prisma.$transaction([
    prisma.payrollLineComponent.create({
      data: { payrollLineId, salaryComponentId, amount, isAdhoc: true },
    }),
    prisma.payrollLine.update({
      where: { id: payrollLineId },
      data: isEarning ? { otherEarningsTotal: { increment: amount } } : { otherDeductionsTotal: { increment: amount } },
    }),
  ]);

  const netDelta = isEarning ? amount : -amount;
  return prisma.payrollLine.update({
    where: { id: payrollLineId },
    data: { netSalary: Number(updated.netSalary) + netDelta },
  });
}
