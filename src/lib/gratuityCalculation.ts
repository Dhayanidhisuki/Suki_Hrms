/**
 * Gratuity Phase 1 — calculation engine.
 *
 * Triggered per-employee by their own ExitInterview (not a whole-company
 * batch like Bonus). Reads: the ExitInterview (doj/separationDate come from
 * Employee.jobInfo.joinDate / ExitInterview.exitDate), the
 * EmployeeSalaryRevision that was current *as of the separation date* (not
 * "current now" — BR-008: use the salary/policy applicable to the relevant
 * effective date, since a revision could've been approved after separation
 * for back-pay reasons but shouldn't change what gratuity was based on),
 * and the company's current GratuityPolicy.
 *
 * Formula (BRD §9/§20, kept configurable rather than hard-coded):
 *   eligibleSalary = sum of includeInGratuity-flagged components on that revision
 *   grossGratuity = round(eligibleSalary x multiplierNumerator / multiplierDenominator x qualifyingServiceYears)
 *   payableGratuity = min(grossGratuity, policy.maxGratuityCeiling)
 * Both amounts are retained (BRD §13) — payableGratuity is what actually
 * gets paid, grossGratuity is kept for audit even if the ceiling capped it.
 *
 * Documented simplifications (Phase 1, not the full BRD):
 * - qualifyingServiceYears = (separationDate - doj) / 365.25 — no
 *   "continuous service start date" / "service break" handling (§8).
 * - One company-wide GratuityPolicy, not category-specific.
 */

import { prisma } from './prisma';

function round(n: number) {
  return Math.round(n);
}

export async function calculateGratuity(companyId: number, employeeId: number) {
  const exitInterview = await prisma.exitInterview.findUnique({ where: { employeeId } });
  if (!exitInterview) {
    throw new Error('This employee has no recorded separation (Exit Form) yet.');
  }

  const existing = await prisma.gratuityRecord.findUnique({ where: { exitInterviewId: exitInterview.id } });
  if (existing && existing.status !== 'CALCULATED' && existing.status !== 'NOT_ELIGIBLE') {
    throw new Error(`Cannot recalculate a gratuity record in ${existing.status} status.`);
  }

  const jobInfo = await prisma.jobInfo.findFirst({
    where: { employeeId },
    orderBy: { effectiveFrom: 'asc' },
    select: { joinDate: true },
  });
  if (!jobInfo) {
    throw new Error('This employee has no Job Profile (joinDate) on record.');
  }

  const policy = await prisma.gratuityPolicy.findFirst({ where: { companyId, effectiveTo: null, isActive: true } });
  if (!policy) {
    throw new Error('No active GratuityPolicy is configured.');
  }

  const doj = jobInfo.joinDate;
  const separationDate = exitInterview.exitDate;
  const qualifyingServiceYears = Number(
    ((separationDate.getTime() - doj.getTime()) / (365.25 * 24 * 60 * 60 * 1000)).toFixed(2)
  );

  let eligibilityStatus: string;
  let eligibilityReason: string | null;
  if (qualifyingServiceYears < Number(policy.minEligibleServiceYears)) {
    eligibilityStatus = 'NOT_ELIGIBLE_SERVICE';
    eligibilityReason = `Qualifying service (${qualifyingServiceYears} years) is below the configured minimum of ${policy.minEligibleServiceYears} years.`;
  } else {
    eligibilityStatus = 'ELIGIBLE';
    eligibilityReason = null;
  }

  let eligibleSalary: number | null = null;
  let multiplierNumerator: number | null = null;
  let multiplierDenominator: number | null = null;
  let grossGratuity: number | null = null;
  let payableGratuity: number | null = null;

  if (eligibilityStatus === 'ELIGIBLE') {
    const revision = await prisma.employeeSalaryRevision.findFirst({
      where: { employeeId, effectiveFrom: { lte: separationDate } },
      orderBy: { effectiveFrom: 'desc' },
      include: { components: { include: { salaryComponent: { select: { includeInGratuity: true } } } } },
    });
    if (!revision) {
      throw new Error('This employee has no salary revision effective on or before the separation date.');
    }

    eligibleSalary = round(
      revision.components
        .filter((c) => c.salaryComponent.includeInGratuity)
        .reduce((sum, c) => sum + Number(c.amount), 0)
    );
    multiplierNumerator = Number(policy.multiplierNumerator);
    multiplierDenominator = Number(policy.multiplierDenominator);
    grossGratuity = round(eligibleSalary * (multiplierNumerator / multiplierDenominator) * qualifyingServiceYears);
    payableGratuity = Math.min(grossGratuity, Number(policy.maxGratuityCeiling));
  }

  // Mirrors BonusRecord's convention: eligible records are CALCULATED (can
  // be approved); ineligible ones get their own terminal status so the
  // approve guard (status === 'CALCULATED') alone is enough to block them.
  const data = {
    companyId,
    employeeId,
    exitInterviewId: exitInterview.id,
    doj,
    separationDate,
    qualifyingServiceYears,
    eligibilityStatus,
    eligibilityReason,
    eligibleSalary,
    multiplierNumerator,
    multiplierDenominator,
    grossGratuity,
    payableGratuity,
    status: eligibilityStatus === 'ELIGIBLE' ? 'CALCULATED' : 'NOT_ELIGIBLE',
    calculatedAt: new Date(),
  };

  if (existing) {
    return prisma.gratuityRecord.update({ where: { id: existing.id }, data });
  }
  return prisma.gratuityRecord.create({ data });
}
