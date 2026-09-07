/**
 * Pushes a CALCULATED SalaryArrear into a target PayrollRun as ad-hoc
 * PayrollLineComponent rows — reuses the exact ad-hoc mechanism Payroll
 * Phase 1 already built/tested (PayrollLineComponent.isAdhoc: true) rather
 * than inventing a separate payroll-input concept for arrears. One earning
 * line (Salary Arrear, gross) plus up to two deduction lines (PF Arrear,
 * ESI Arrear) sized by the arrear's totals — 3 SalaryComponent catalog rows
 * seeded by scripts/seed-arrear-components.mjs.
 */

import { prisma } from './prisma';
import { checkPayrollRunEditable } from './payrollGuard';

export async function applyArrearToPayroll(salaryArrearId: number, payrollRunId: number) {
  const arrear = await prisma.salaryArrear.findUniqueOrThrow({ where: { id: salaryArrearId } });

  if (arrear.status === 'APPLIED') {
    throw new Error('This arrear has already been applied to payroll.');
  }

  const guardErr = await checkPayrollRunEditable(payrollRunId);
  if (guardErr) {
    const body = await guardErr.json();
    throw new Error(body.error ?? 'Target payroll run is not editable.');
  }

  const line = await prisma.payrollLine.findUnique({
    where: { payrollRunId_employeeId: { payrollRunId, employeeId: arrear.employeeId } },
  });
  if (!line) {
    throw new Error('This employee has no payroll line in the target run — calculate that run first.');
  }

  const [grossComponent, pfComponent, esiComponent] = await Promise.all([
    prisma.salaryComponent.findUniqueOrThrow({ where: { companyId_code: { companyId: arrear.companyId, code: 'ARREAR_GROSS' } } }),
    prisma.salaryComponent.findUniqueOrThrow({ where: { companyId_code: { companyId: arrear.companyId, code: 'ARREAR_PF' } } }),
    prisma.salaryComponent.findUniqueOrThrow({ where: { companyId_code: { companyId: arrear.companyId, code: 'ARREAR_ESI' } } }),
  ]);

  const grossArrear = Number(arrear.grossArrearTotal);
  const pfArrear = Number(arrear.pfArrearTotal);
  const esiArrear = Number(arrear.esiArrearTotal);

  await prisma.$transaction(async (tx) => {
    if (grossArrear !== 0) {
      await tx.payrollLineComponent.create({
        data: { payrollLineId: line.id, salaryComponentId: grossComponent.id, amount: grossArrear, isAdhoc: true },
      });
    }
    if (pfArrear !== 0) {
      await tx.payrollLineComponent.create({
        data: { payrollLineId: line.id, salaryComponentId: pfComponent.id, amount: pfArrear, isAdhoc: true },
      });
    }
    if (esiArrear !== 0) {
      await tx.payrollLineComponent.create({
        data: { payrollLineId: line.id, salaryComponentId: esiComponent.id, amount: esiArrear, isAdhoc: true },
      });
    }

    const otherEarningsTotal = Number(line.otherEarningsTotal) + grossArrear;
    const otherDeductionsTotal = Number(line.otherDeductionsTotal) + pfArrear + esiArrear;
    const netSalary = Number(line.netSalary) + grossArrear - pfArrear - esiArrear;

    await tx.payrollLine.update({
      where: { id: line.id },
      data: { otherEarningsTotal, otherDeductionsTotal, netSalary },
    });

    await tx.salaryArrear.update({
      where: { id: salaryArrearId },
      data: { status: 'APPLIED', appliedPayrollRunId: payrollRunId, appliedAt: new Date() },
    });
  });
}
