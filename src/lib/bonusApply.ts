/**
 * Pushes an APPROVED BonusRecord into a target PayrollRun as one ad-hoc
 * earning PayrollLineComponent — same mechanism as
 * src/lib/arrearApply.ts (Tier 4), reusing checkPayrollRunEditable rather
 * than inventing a separate payroll-input concept for bonus.
 */

import { prisma } from './prisma';
import { checkPayrollRunEditable } from './payrollGuard';

export async function applyBonusToPayroll(bonusRecordId: number, payrollRunId: number) {
  const record = await prisma.bonusRecord.findUniqueOrThrow({ where: { id: bonusRecordId } });

  if (record.status !== 'APPROVED') {
    throw new Error(`Bonus record is ${record.status.toLowerCase()} — only an approved bonus can be applied to payroll.`);
  }

  const guardErr = await checkPayrollRunEditable(payrollRunId);
  if (guardErr) {
    const body = await guardErr.json();
    throw new Error(body.error ?? 'Target payroll run is not editable.');
  }

  const line = await prisma.payrollLine.findUnique({
    where: { payrollRunId_employeeId: { payrollRunId, employeeId: record.employeeId } },
  });
  if (!line) {
    throw new Error('This employee has no payroll line in the target run — calculate that run first.');
  }

  const bonusComponent = await prisma.salaryComponent.findUniqueOrThrow({ where: { companyId_code: { companyId: record.companyId, code: 'BONUS' } } });
  const bonusAmount = Number(record.bonusAmount ?? 0);

  await prisma.$transaction(async (tx) => {
    if (bonusAmount !== 0) {
      await tx.payrollLineComponent.create({
        data: { payrollLineId: line.id, salaryComponentId: bonusComponent.id, amount: bonusAmount, isAdhoc: true },
      });
    }

    const otherEarningsTotal = Number(line.otherEarningsTotal) + bonusAmount;
    const netSalary = Number(line.netSalary) + bonusAmount;

    await tx.payrollLine.update({
      where: { id: line.id },
      data: { otherEarningsTotal, netSalary },
    });

    await tx.bonusRecord.update({
      where: { id: bonusRecordId },
      data: { status: 'PROCESSED', appliedPayrollRunId: payrollRunId, appliedAt: new Date() },
    });
  });
}
