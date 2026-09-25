/**
 * Pushes a comp-off encashment into a target PayrollRun as one ad-hoc
 * earning PayrollLineComponent — same mechanism as src/lib/bonusApply.ts
 * (BONUS) and src/lib/arrearApply.ts, keyed on the COMPOFF_ENCASH
 * SalaryComponent. Unlike bonus/arrears there is no separate approval
 * record to flip to PROCESSED — the CompOffTransaction row written by
 * encashCompOff() is the audit trail.
 *
 * Debits the employee's CompOffBalance and, if a payroll line exists for
 * the given run, adds the resulting amount to that line's Other Earnings.
 * If no line exists yet (run not calculated for this employee), the
 * balance is still encashed — the amount is lost to "Other Earnings"
 * unless the caller recalculates the run afterward, same caveat as
 * bonus/arrears applied before calculation.
 */

import { prisma } from './prisma';
import { encashCompOff } from './compOffTransactions';

export async function encashCompOffIntoPayroll(
  employeeId: number,
  days: number,
  ratePerDay: number,
  payrollRunId: number,
  reason?: string
): Promise<number> {
  const amount = await encashCompOff(employeeId, days, new Date(), ratePerDay, reason);
  if (amount <= 0) return 0;

  const line = await prisma.payrollLine.findUnique({
    where: { payrollRunId_employeeId: { payrollRunId, employeeId } },
  });
  if (!line) return amount;

  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: employeeId },
    select: { companyId: true },
  });
  const component = await prisma.salaryComponent.findUniqueOrThrow({
    where: { companyId_code: { companyId: employee.companyId, code: 'COMPOFF_ENCASH' } },
  });

  await prisma.$transaction([
    prisma.payrollLineComponent.create({
      data: { payrollLineId: line.id, salaryComponentId: component.id, amount, isAdhoc: true },
    }),
    prisma.payrollLine.update({
      where: { id: line.id },
      data: {
        otherEarningsTotal: Number(line.otherEarningsTotal) + amount,
        netSalary: Number(line.netSalary) + amount,
      },
    }),
  ]);

  return amount;
}
