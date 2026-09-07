/**
 * Salary Revision & Arrear Phase 1 — arrear calculation.
 *
 * A revision is retroactive when its effectiveFrom falls in or before a
 * month this company has already run Payroll for (a PayrollRun in
 * CALCULATED/APPROVED/LOCKED status). For every such month, "old gross" is
 * read from that month's actual PayrollLine.grossEarnings — the amount
 * really paid — not re-derived from a salary structure, so the arrear
 * reflects reality even if that month's own calculation had ad-hoc
 * adjustments.
 *
 * PF/ESI arrear mirrors src/lib/payrollCalculation.ts's wage-basis
 * convention (full gross, not a Basic-only subset) for consistency, and
 * reuses that month's own PayrollLine.pfApplicable/esiApplicable snapshot
 * as the gate rather than re-deriving eligibility — that's what actually
 * applied to the employee that month. No PT/TDS arrear (not in the BRD's
 * own arrear formula either).
 *
 * If no month qualifies (the revision is fully forward-dated), no
 * SalaryArrear is created at all (BR-07).
 */

import { prisma } from './prisma';

function round(n: number) {
  return Math.round(n);
}

export async function calculateArrear(salaryRevisionRequestId: number) {
  const request = await prisma.salaryRevisionRequest.findUniqueOrThrow({
    where: { id: salaryRevisionRequestId },
  });

  if (request.status !== 'APPROVED' || !request.appliedRevisionId) {
    throw new Error('Arrear can only be calculated for an approved, applied revision.');
  }

  const effYear = request.effectiveFrom.getUTCFullYear();
  const effMonth = request.effectiveFrom.getUTCMonth() + 1;

  const candidateRuns = await prisma.payrollRun.findMany({
    where: {
      companyId: request.companyId,
      status: { in: ['CALCULATED', 'APPROVED', 'LOCKED'] },
      OR: [{ year: { gt: effYear } }, { year: effYear, month: { gte: effMonth } }],
    },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
    include: { lines: { where: { employeeId: request.employeeId } } },
  });

  const affected = candidateRuns.filter((run) => run.lines.length > 0);

  const existing = await prisma.salaryArrear.findUnique({ where: { salaryRevisionRequestId } });
  if (existing?.status === 'APPLIED') {
    throw new Error('This arrear has already been applied to payroll and cannot be recalculated.');
  }

  if (affected.length === 0) {
    if (existing) {
      await prisma.$transaction([
        prisma.salaryArrearMonth.deleteMany({ where: { salaryArrearId: existing.id } }),
        prisma.salaryArrear.delete({ where: { id: existing.id } }),
      ]);
    }
    return null;
  }

  const [pfRate, esiRate] = await Promise.all([
    prisma.pfRate.findFirst({ where: { effectiveTo: null, isActive: true } }),
    prisma.esiRate.findFirst({ where: { effectiveTo: null, isActive: true } }),
  ]);

  const revisedGross = Number(request.revisedGross);

  const monthRows = affected.map((run) => {
    const line = run.lines[0];
    const oldGross = Number(line.grossEarnings);
    const grossDifference = round(revisedGross - oldGross);

    let pfArrear = 0;
    if (line.pfApplicable && pfRate) {
      const ceiling = Number(pfRate.wageCeilingMonthly);
      const rate = Number(pfRate.employeeContributionRate) / 100;
      pfArrear = round((Math.min(revisedGross, ceiling) - Math.min(oldGross, ceiling)) * rate);
    }

    let esiArrear = 0;
    if (line.esiApplicable && esiRate && revisedGross <= Number(esiRate.wageCeilingMonthly)) {
      esiArrear = round(grossDifference * (Number(esiRate.employeeContributionRate) / 100));
    }

    const netArrear = round(grossDifference - pfArrear - esiArrear);

    return { year: run.year, month: run.month, oldGross, revisedGross, grossDifference, pfArrear, esiArrear, netArrear };
  });

  const grossArrearTotal = monthRows.reduce((s, m) => s + m.grossDifference, 0);
  const pfArrearTotal = monthRows.reduce((s, m) => s + m.pfArrear, 0);
  const esiArrearTotal = monthRows.reduce((s, m) => s + m.esiArrear, 0);
  const netArrearTotal = monthRows.reduce((s, m) => s + m.netArrear, 0);

  const header = {
    employeeId: request.employeeId,
    companyId: request.companyId,
    oldGross: monthRows[0].oldGross,
    revisedGross,
    arrearFromYear: monthRows[0].year,
    arrearFromMonth: monthRows[0].month,
    arrearToYear: monthRows[monthRows.length - 1].year,
    arrearToMonth: monthRows[monthRows.length - 1].month,
    grossArrearTotal,
    pfArrearTotal,
    esiArrearTotal,
    netArrearTotal,
    status: 'CALCULATED' as const,
    calculatedAt: new Date(),
  };

  const arrear = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.salaryArrearMonth.deleteMany({ where: { salaryArrearId: existing.id } });
      return tx.salaryArrear.update({
        where: { id: existing.id },
        data: { ...header, months: { create: monthRows } },
      });
    }
    return tx.salaryArrear.create({
      data: { salaryRevisionRequestId, ...header, months: { create: monthRows } },
    });
  });

  return arrear;
}
