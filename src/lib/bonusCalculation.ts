/**
 * Bonus Management Phase 1 — calculation engine.
 *
 * Reads: the employee's current EmployeeSalaryRevision (effectiveTo: null,
 * for grossSalary + the BASIC component), current JobInfo (for joinDate),
 * and the company's current (effectiveTo: null) BonusRate — whose
 * calculationType picks which of two formulas produces annualBonusWage:
 *
 * - BASIC_PROJECTION (original Tier 5a logic): min(Basic, calculationWageCeiling) x 12.
 *   A projection off the current Basic salary snapshot — matches the BRD's
 *   own worked example, independent of actual attendance.
 * - ACTUAL_NET_PAY: sum of PayrollLine.netSalary actually paid across every
 *   already-processed (CALCULATED/APPROVED/LOCKED) PayrollRun in the
 *   accounting year (Apr acYear - Mar acYear+1) — real payroll history,
 *   already reflecting LOP, instead of a flat projection. Zero processed
 *   months -> eligibilityStatus MANUAL_REVIEW, no fabricated amount.
 *
 * Either type: bonusAmount = round(annualBonusWage x bonusRate.ratePercent / 100).
 * annualBonusWage is stored on the record so PUT /api/bonus/records/[id]
 * can recompute bonusAmount from an edited bonusPercent without re-touching
 * Payroll data.
 *
 * Documented simplifications (Phase 1, not the full BRD):
 * - Eligibility's "worked >= minWorkingDays" is a DOJ-vs-calculation-date
 *   proxy (joinDate <= calculationDate - minWorkingDays), not a true sum of
 *   attendance days across the accounting year — applies identically to
 *   both calculation types.
 * - calculationDate is fixed at March 31 of (acYear + 1) — not a separate
 *   configurable policy field.
 * - Recalculating skips APPROVED/PROCESSED records (preserved), matching
 *   how Payroll Phase 1 preserves ad-hoc entries on recalculation.
 */

import { prisma } from './prisma';

function round(n: number) {
  return Math.round(n);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// The 12 (year, month) pairs of the accounting year: April acYear - March acYear+1.
function fiscalYearMonths(acYear: number): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  let y = acYear;
  let m = 4;
  for (let i = 0; i < 12; i++) {
    months.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

export async function calculateBonusRecords(companyId: number, acYear: number) {
  const calculationDate = new Date(Date.UTC(acYear + 1, 2, 31)); // March 31 of acYear+1
  const now = new Date();
  const fyMonths = fiscalYearMonths(acYear);

  const [employees, bonusRate, basicComponent, payrollRuns] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      select: {
        id: true,
        salaryRevisions: {
          where: { effectiveTo: null },
          take: 1,
          select: { grossSalary: true, components: { select: { amount: true, salaryComponent: { select: { code: true } } } } },
        },
        jobInfos: { where: { effectiveTo: null }, take: 1, select: { joinDate: true } },
      },
    }),
    prisma.bonusRate.findFirst({ where: { companyId, effectiveTo: null, isActive: true } }),
    prisma.salaryComponent.findUnique({ where: { companyId_code: { companyId, code: 'BASIC' } } }),
    prisma.payrollRun.findMany({
      where: {
        companyId,
        status: { in: ['CALCULATED', 'APPROVED', 'LOCKED'] },
        OR: fyMonths.map((m) => ({ year: m.year, month: m.month })),
      },
      include: { lines: { select: { employeeId: true, netSalary: true } } },
    }),
  ]);

  if (!bonusRate) {
    throw new Error('No active BonusRate is configured.');
  }

  // employeeId -> summed actual netSalary across every processed month this FY
  const actualNetPayByEmployee = new Map<number, number>();
  for (const run of payrollRuns) {
    for (const line of run.lines) {
      actualNetPayByEmployee.set(line.employeeId, (actualNetPayByEmployee.get(line.employeeId) ?? 0) + Number(line.netSalary));
    }
  }

  const existing = await prisma.bonusRecord.findMany({
    where: { companyId, acYear },
    select: { id: true, employeeId: true, status: true },
  });
  const existingByEmployee = new Map(existing.map((r) => [r.employeeId, r]));

  let calculated = 0;
  let notEligible = 0;
  let skipped = 0;

  for (const emp of employees) {
    const current = existingByEmployee.get(emp.id);
    if (current && (current.status === 'APPROVED' || current.status === 'PROCESSED')) {
      skipped++;
      continue;
    }

    const revision = emp.salaryRevisions[0];
    const jobInfo = emp.jobInfos[0];
    if (!revision || !jobInfo) continue; // no salary structure / job info — nothing to evaluate

    const currentGross = Number(revision.grossSalary);
    const basicRow = basicComponent ? revision.components.find((c) => c.salaryComponent.code === 'BASIC') : undefined;
    const currentBasic = basicRow ? Number(basicRow.amount) : 0;
    const joinDate = jobInfo.joinDate;

    const yearsOfService = Number(
      ((calculationDate.getTime() - joinDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)).toFixed(2)
    );

    let eligibilityStatus: string;
    let eligibilityReason: string | null;
    if (currentGross > Number(bonusRate.wageEligibilityCeiling)) {
      eligibilityStatus = 'NOT_ELIGIBLE_WAGE';
      eligibilityReason = `Gross salary ₹${currentGross} exceeds the eligibility ceiling of ₹${bonusRate.wageEligibilityCeiling}.`;
    } else if (joinDate > addDays(calculationDate, -bonusRate.minWorkingDays)) {
      eligibilityStatus = 'NOT_ELIGIBLE_SERVICE';
      eligibilityReason = `Joined less than ${bonusRate.minWorkingDays} days before the calculation date.`;
    } else {
      eligibilityStatus = 'ELIGIBLE';
      eligibilityReason = null;
    }

    let bonusPercent: number | null = null;
    let bonusAmount: number | null = null;
    let annualBonusWage: number | null = null;
    let status: string;

    if (eligibilityStatus === 'ELIGIBLE' && bonusRate.calculationType === 'ACTUAL_NET_PAY') {
      const actualNetPay = actualNetPayByEmployee.get(emp.id);
      if (actualNetPay === undefined) {
        // No processed payroll months this FY — nothing to sum, don't fabricate a bonus.
        eligibilityStatus = 'MANUAL_REVIEW';
        eligibilityReason = 'No processed payroll months this accounting year to base the bonus on.';
        status = 'NOT_ELIGIBLE';
        bonusAmount = 0;
        notEligible++;
      } else {
        annualBonusWage = round(actualNetPay);
        bonusPercent = Number(bonusRate.ratePercent);
        bonusAmount = round(annualBonusWage * (bonusPercent / 100));
        status = 'CALCULATED';
        calculated++;
      }
    } else if (eligibilityStatus === 'ELIGIBLE') {
      // BASIC_PROJECTION (default/original logic)
      annualBonusWage = round(Math.min(currentBasic, Number(bonusRate.calculationWageCeiling)) * 12);
      bonusPercent = Number(bonusRate.ratePercent);
      bonusAmount = round(annualBonusWage * (bonusPercent / 100));
      status = 'CALCULATED';
      calculated++;
    } else {
      bonusAmount = 0;
      status = 'NOT_ELIGIBLE';
      notEligible++;
    }

    await prisma.bonusRecord.upsert({
      where: { companyId_employeeId_acYear: { companyId, employeeId: emp.id, acYear } },
      update: {
        currentGross,
        currentBasic,
        doj: joinDate,
        yearsOfService,
        eligibilityStatus,
        eligibilityReason,
        calculationType: bonusRate.calculationType,
        annualBonusWage,
        bonusPercent,
        bonusAmount,
        status,
        calculatedAt: now,
      },
      create: {
        companyId,
        employeeId: emp.id,
        acYear,
        currentGross,
        currentBasic,
        doj: joinDate,
        yearsOfService,
        eligibilityStatus,
        eligibilityReason,
        calculationType: bonusRate.calculationType,
        annualBonusWage,
        bonusPercent,
        bonusAmount,
        status,
        calculatedAt: now,
      },
    });
  }

  return { calculated, notEligible, skipped };
}
