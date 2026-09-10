/**
 * Shared core of POST /api/payroll/runs/[id]/lines/[lineId]/adhoc — pulled
 * out so the new benefit-rate auto-apply and bulk ad-hoc upload can reuse
 * the exact same PayrollLineComponent + running-total update logic instead
 * of re-deriving it. See that route's own header comment for why this is a
 * delta update, not a full re-sum.
 *
 * IMPORTANT: After applying the ad-hoc component, PF/ESI/PT/TDS are fully
 * recalculated against the updated totals so that statutory deductions
 * reflect the new taxable base.
 */

import { prisma } from './prisma';

function round(n: number) {
  return Math.round(n);
}

export async function applyAdhocLine(payrollLineId: number, salaryComponentId: number, rawAmount: number) {
  const component = await prisma.salaryComponent.findUnique({ where: { id: salaryComponentId } });
  if (!component || (component.type !== 'earning' && component.type !== 'deduction')) {
    throw new Error('Invalid or non-earning/deduction salary component');
  }

  const amount = round(Math.abs(rawAmount));
  const isEarning = component.type === 'earning';

  // Step 1: Create the ad-hoc component row and update the running total
  await prisma.$transaction([
    prisma.payrollLineComponent.create({
      data: { payrollLineId, salaryComponentId, amount, isAdhoc: true },
    }),
    prisma.payrollLine.update({
      where: { id: payrollLineId },
      data: isEarning
        ? { otherEarningsTotal: { increment: amount } }
        : { otherDeductionsTotal: { increment: amount } },
    }),
  ]);

  // Step 2: Re-read the full line and recalculate statutory deductions
  // against the updated totals so PF/ESI/PT/TDS reflect the new taxable base.
  const line = await prisma.payrollLine.findUniqueOrThrow({
    where: { id: payrollLineId },
    include: { payrollRun: { select: { companyId: true } } },
  });

  const grossEarnings = Number(line.grossEarnings);
  const otAmount = Number(line.otAmount);
  const otherEarningsTotal = Number(line.otherEarningsTotal);
  const otherDeductionsTotal = Number(line.otherDeductionsTotal);
  const totalTaxable = grossEarnings + otAmount + otherEarningsTotal;

  // PF recalculation
  let pfEmployee = 0;
  let pfEmployer = 0;
  let epsEmployer = 0;
  if (line.pfApplicable) {
    const pfRate = await prisma.pfRate.findFirst({ where: { effectiveTo: null, isActive: true } });
    if (pfRate) {
      const ceiling = Number(pfRate.wageCeilingMonthly);
      const pfWage = Math.min(totalTaxable, ceiling);
      pfEmployee = round(pfWage * (Number(pfRate.employeeContributionRate) / 100));
      // Employer: total employerContributionRate split into EPF + EPS
      const employerRate = Number(pfRate.employerContributionRate) / 100;
      const epsRate = Number(pfRate.pensionContributionRate ?? 8.33) / 100;
      const pfEmployerTotal = round(pfWage * employerRate);
      epsEmployer = round(pfWage * epsRate);
      pfEmployer = pfEmployerTotal - epsEmployer;
    }
  }

  // ESI recalculation
  let esiEmployee = 0;
  let esiEmployer = 0;
  if (line.esiApplicable) {
    const esiRate = await prisma.esiRate.findFirst({ where: { effectiveTo: null, isActive: true } });
    if (esiRate && totalTaxable <= Number(esiRate.wageCeilingMonthly)) {
      esiEmployee = round(totalTaxable * (Number(esiRate.employeeContributionRate) / 100));
      esiEmployer = round(totalTaxable * (Number(esiRate.employerContributionRate) / 100));
    }
  }

  // PT recalculation
  let professionalTax = 0;
  if (line.ptApplicable) {
    const ptSlabs = await prisma.professionalTaxSlab.findMany({
      where: { isActive: true },
      orderBy: { minSalary: 'asc' },
    });
    const slab = ptSlabs.find(
      (s) => totalTaxable >= Number(s.minSalary) && (s.maxSalary === null || totalTaxable <= Number(s.maxSalary))
    );
    professionalTax = slab ? Number(slab.monthlyAmount) : 0;
  }

  // TDS recalculation
  const tdsSlabs = await prisma.tDSSlab.findMany({
    where: { isActive: true },
    orderBy: { minSalary: 'asc' },
  });
  const tdsSlab = tdsSlabs.find(
    (s: { minSalary: unknown; maxSalary: unknown; ratePercent: unknown }) => totalTaxable >= Number(s.minSalary) && (s.maxSalary === null || totalTaxable <= Number(s.maxSalary))
  );
  const tds = tdsSlab ? round(totalTaxable * (Number(tdsSlab.ratePercent) / 100)) : 0;

  const netSalary = round(
    grossEarnings + otAmount + otherEarningsTotal - pfEmployee - esiEmployee - professionalTax - tds - otherDeductionsTotal
  );

  return prisma.payrollLine.update({
    where: { id: payrollLineId },
    data: {
      pfEmployee,
      pfEmployer,
      epsEmployer,
      esiEmployee,
      esiEmployer,
      professionalTax,
      tds,
      netSalary,
    },
  });
}
