/**
 * Annual TDS calculation engine — computes annual tax liability for an
 * employee based on their YTD gross earnings, approved investment
 * declaration, and the company's TdsRegimeConfig.
 *
 * Tax formula:
 *   1. taxableIncome = grossYTD + otherIncome - deductions
 *      - OLD regime: standardDeduction + 80C + 80D + 80CCD + ... + HRA
 *      - NEW regime: standardDeduction only (no investment deductions)
 *   2. tax = sum of slab rates × taxableIncome (using TDSSlab table)
 *   3. rebate87A: if taxableIncome <= rebateUptoIncome, subtract rebateAmount
 *   4. surcharge: if taxableIncome > surchargeThreshold, add surchargeRate% of tax
 *   5. cess: add cessRate% of (tax + surcharge)
 *   6. annualTax = tax - rebate87A + surcharge + cess
 *   7. monthlyTDS = annualTax / 12
 *   8. remainingTDS = (annualTax - alreadyDeductedTDS) / remainingMonths
 */

import { prisma } from '@/lib/prisma';

export interface AnnualTdsResult {
  employeeId: number;
  financialYear: number;
  regime: 'OLD' | 'NEW';
  grossYTD: number;
  otherIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  baseTax: number;
  rebate87A: number;
  taxAfterRebate: number;
  surcharge: number;
  cess: number;
  annualTax: number;
  monthlyTDS: number;
  alreadyDeductedTDS: number;
  remainingMonths: number;
  remainingTDS: number;
  slabBreakdown: Array<{ code: string; minSalary: number; maxSalary: number | null; ratePercent: number; taxInSlab: number }>;
}

/**
 * Calculate annual TDS for an employee for a financial year.
 *
 * @param employeeId  The employee
 * @param financialYear  e.g. 2026 for FY 2026-27
 * @param grossYTD  Year-to-date gross earnings (caller computes from payroll lines)
 * @param alreadyDeductedTDS  TDS already deducted in YTD payroll runs
 * @param remainingMonths  Months remaining in the financial year (including current)
 */
export async function calculateAnnualTds(
  employeeId: number,
  financialYear: number,
  grossYTD: number,
  alreadyDeductedTDS: number,
  remainingMonths: number
): Promise<AnnualTdsResult> {
  // Load the employee's company.
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { companyId: true },
  });
  if (!employee) {
    throw new Error(`Employee ${employeeId} not found`);
  }

  // Load the company's TDS regime config.
  const config = await prisma.tdsRegimeConfig.findUnique({
    where: { companyId: employee.companyId },
  });

  // Load the latest approved declaration (or null).
  const declaration = await prisma.tdsInvestmentDeclaration.findFirst({
    where: {
      employeeId,
      financialYear,
      status: 'approved',
    },
    orderBy: { approvedAt: 'desc' },
  });

  // Determine regime: declaration's regime > config default > NEW.
  const regime: 'OLD' | 'NEW' = (declaration?.regime as 'OLD' | 'NEW') ?? (config?.defaultRegime as 'OLD' | 'NEW') ?? 'NEW';

  // Load TDS slabs.
  const slabs = await prisma.tDSSlab.findMany({
    where: { effectiveTo: null, isActive: true },
    orderBy: { minSalary: 'asc' },
  });

  // Compute deductions.
  const standardDeduction = Number(config?.standardDeduction ?? 50000);
  let totalDeductions = 0;
  let otherIncome = 0;

  if (regime === 'OLD' && declaration) {
    totalDeductions =
      standardDeduction +
      Math.min(Number(declaration.section80C), 150000) +
      Math.min(Number(declaration.section80D), 100000) +
      Math.min(Number(declaration.section80CCD), 50000) +
      Number(declaration.section80G) +
      Number(declaration.section80E) +
      Math.min(Number(declaration.section80TTA), 10000) +
      Number(declaration.otherDeductions) +
      Number(declaration.hraExemption);
    otherIncome = Number(declaration.otherIncome);
  } else if (regime === 'NEW') {
    // New regime: only standard deduction, no investment deductions.
    totalDeductions = standardDeduction;
    otherIncome = Number(declaration?.otherIncome ?? 0);
  }

  const taxableIncome = Math.max(0, grossYTD + otherIncome - totalDeductions);

  // Compute base tax using slab rates.
  let baseTax = 0;
  let remainingIncome = taxableIncome;
  const slabBreakdown: AnnualTdsResult['slabBreakdown'] = [];

  for (const slab of slabs) {
    if (remainingIncome <= 0) break;
    const slabMin = Number(slab.minSalary);
    const slabMax = slab.maxSalary != null ? Number(slab.maxSalary) : Infinity;
    const slabWidth = Math.min(remainingIncome, slabMax - slabMin);
    if (slabWidth <= 0) continue;
    const rate = Number(slab.ratePercent) / 100;
    const taxInSlab = slabWidth * rate;
    baseTax += taxInSlab;
    slabBreakdown.push({
      code: slab.code,
      minSalary: slabMin,
      maxSalary: slab.maxSalary != null ? Number(slab.maxSalary) : null,
      ratePercent: Number(slab.ratePercent),
      taxInSlab: Number(taxInSlab.toFixed(2)),
    });
    remainingIncome -= slabWidth;
  }

  // 87A rebate.
  const rebateUptoIncome = Number(config?.rebateUptoIncome ?? 500000);
  const rebateAmount = Number(config?.rebateAmount ?? 12500);
  const rebate87A = taxableIncome <= rebateUptoIncome ? Math.min(baseTax, rebateAmount) : 0;
  const taxAfterRebate = Math.max(0, baseTax - rebate87A);

  // Surcharge.
  const surchargeThreshold = Number(config?.surchargeThreshold ?? 5000000);
  const surchargeRate = Number(config?.surchargeRate ?? 10) / 100;
  const surcharge = taxableIncome > surchargeThreshold ? taxAfterRebate * surchargeRate : 0;

  // Cess.
  const cessRate = Number(config?.cessRate ?? 4) / 100;
  const cess = (taxAfterRebate + surcharge) * cessRate;

  const annualTax = taxAfterRebate + surcharge + cess;
  const monthlyTDS = annualTax / 12;
  const remainingTDS = remainingMonths > 0
    ? Math.max(0, (annualTax - alreadyDeductedTDS) / remainingMonths)
    : Math.max(0, annualTax - alreadyDeductedTDS);

  return {
    employeeId,
    financialYear,
    regime,
    grossYTD: Number(grossYTD.toFixed(2)),
    otherIncome: Number(otherIncome.toFixed(2)),
    totalDeductions: Number(totalDeductions.toFixed(2)),
    taxableIncome: Number(taxableIncome.toFixed(2)),
    baseTax: Number(baseTax.toFixed(2)),
    rebate87A: Number(rebate87A.toFixed(2)),
    taxAfterRebate: Number(taxAfterRebate.toFixed(2)),
    surcharge: Number(surcharge.toFixed(2)),
    cess: Number(cess.toFixed(2)),
    annualTax: Number(annualTax.toFixed(2)),
    monthlyTDS: Number(monthlyTDS.toFixed(2)),
    alreadyDeductedTDS: Number(alreadyDeductedTDS.toFixed(2)),
    remainingMonths,
    remainingTDS: Number(remainingTDS.toFixed(2)),
    slabBreakdown,
  };
}
