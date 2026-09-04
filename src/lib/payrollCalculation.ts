/**
 * Payroll Processing Phase 1 — calculation engine.
 *
 * Reads: the employee's current EmployeeSalaryRevision (effectiveTo: null)
 * + its EmployeeSalaryComponent rows (NOT EmployeeCtc — zero consumers,
 * explicitly forbids invented formulas; NOT the legacy SalaryStructure),
 * that period's MonthlyAttendanceSummary, JobInfo's eligibility flags, and
 * the current (effectiveTo: null) PfRate/EsiRate/ProfessionalTaxSlab/
 * TDSSlab.
 *
 * Documented simplifications (Phase 1, not the full BRD):
 * - LOP proration is applied uniformly to every recurring earning/deduction
 *   component (lopFactor = payableDays / totalWorkingDays), not per-component
 *   rules.
 * - PF/ESI wage basis is the full LOP-adjusted gross earnings, not a
 *   component-code-specific "Basic + DA" subset — avoids a fragile
 *   dependency on which SalaryComponent codes exist in a given company's
 *   catalog.
 * - TDS is a flat single-slab lookup against TDSSlab (min/maxSalary vs.
 *   monthly gross), not full annual computation with regime/exemptions/
 *   rebate/surcharge/cess.
 * - Recalculating a DRAFT/CALCULATED run replaces only the system-generated
 *   (isAdhoc: false) component rows — ad-hoc entries a user added survive a
 *   recalculation.
 */

import { prisma } from './prisma';

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function round(n: number) {
  return Math.round(n);
}

export async function calculatePayrollRun(payrollRunId: number) {
  const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id: payrollRunId } });
  const { companyId, year, month } = run;
  const totalWorkingDays = daysInMonth(year, month);
  const now = new Date();

  const [employees, pfRate, esiRate, ptSlabs, tdsSlabs] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      select: {
        id: true,
        salaryRevisions: {
          where: { effectiveTo: null },
          take: 1,
          select: {
            id: true,
            grossSalary: true,
            components: { select: { amount: true, salaryComponent: { select: { id: true, type: true } } } },
          },
        },
        jobInfos: {
          where: { effectiveTo: null },
          take: 1,
          select: {
            esiApplicable: true,
            professionalTaxApplicable: true,
            overtimeAllowed: true,
            overtimeFactor: true,
            overtimeRatePerHour: true,
          },
        },
      },
    }),
    prisma.pfRate.findFirst({ where: { effectiveTo: null, isActive: true } }),
    prisma.esiRate.findFirst({ where: { effectiveTo: null, isActive: true } }),
    prisma.professionalTaxSlab.findMany({ where: { effectiveTo: null, isActive: true } }),
    prisma.tDSSlab.findMany({ where: { effectiveTo: null, isActive: true } }),
  ]);

  // Well-known catalog components used for itemized PF/ESI payslip lines —
  // isSystemDefined, so every company's catalog is guaranteed to have them
  // (seeded by bootstrap-admin via src/lib/defaultSalaryComponents.ts).
  const [pfComponent, esiComponent] = await Promise.all([
    prisma.salaryComponent.findUnique({ where: { companyId_code: { companyId, code: 'PF' } } }),
    prisma.salaryComponent.findUnique({ where: { companyId_code: { companyId, code: 'ESI' } } }),
  ]);

  let calculated = 0;
  let onHold = 0;

  for (const emp of employees) {
    const revision = emp.salaryRevisions[0];
    const jobInfo = emp.jobInfos[0];
    if (!revision) continue; // no salary structure at all — nothing to run payroll on

    const line = await prisma.payrollLine.upsert({
      where: { payrollRunId_employeeId: { payrollRunId, employeeId: emp.id } },
      update: {},
      create: { payrollRunId, employeeId: emp.id },
    });

    const summary = await prisma.monthlyAttendanceSummary.findUnique({
      where: { employeeId_year_month: { employeeId: emp.id, year, month } },
    });

    if (!summary || summary.status === 'OPEN') {
      await prisma.payrollLine.update({
        where: { id: line.id },
        data: {
          totalWorkingDays,
          payableDays: 0,
          lopDays: 0,
          grossEarnings: 0,
          otAmount: 0,
          otherEarningsTotal: 0,
          pfEmployee: 0,
          esiEmployee: 0,
          professionalTax: 0,
          tds: 0,
          otherDeductionsTotal: 0,
          netSalary: 0,
          status: 'HOLD',
          holdReason: !summary ? 'No attendance record for this period' : 'Attendance not finalized for this period',
        },
      });
      await prisma.payrollLineComponent.deleteMany({ where: { payrollLineId: line.id, isAdhoc: false } });
      onHold++;
      continue;
    }

    const payableDays = summary.totalWorkingDays - summary.lopDays;
    const lopFactor = summary.totalWorkingDays > 0 ? payableDays / summary.totalWorkingDays : 1;

    let grossEarnings = 0;
    let recurringDeductions = 0;
    const newComponentRows: { salaryComponentId: number; amount: number }[] = [];

    for (const c of revision.components) {
      const proratedAmount = Number(c.amount) * lopFactor;
      if (c.salaryComponent.type === 'earning') {
        grossEarnings += proratedAmount;
        newComponentRows.push({ salaryComponentId: c.salaryComponent.id, amount: round(proratedAmount) });
      } else if (c.salaryComponent.type === 'deduction') {
        recurringDeductions += proratedAmount;
        newComponentRows.push({ salaryComponentId: c.salaryComponent.id, amount: round(proratedAmount) });
      }
      // employer_contribution components are employer cost, not part of
      // employee earnings/deductions — skipped in Phase 1.
    }
    grossEarnings = round(grossEarnings);
    recurringDeductions = round(recurringDeductions);

    let otAmount = 0;
    if (jobInfo?.overtimeAllowed && summary.otMinutesTotal > 0) {
      const otHours = summary.otMinutesTotal / 60;
      if (jobInfo.overtimeRatePerHour) {
        otAmount = otHours * Number(jobInfo.overtimeRatePerHour);
      } else {
        const hourlyRate = Number(revision.grossSalary) / totalWorkingDays / 8;
        otAmount = otHours * hourlyRate * Number(jobInfo.overtimeFactor ?? 1);
      }
      otAmount = round(otAmount);
    }

    const pfApplicable = line.pfApplicable; // per-line override, default true, editable before approval
    let pfEmployee = 0;
    if (pfApplicable && pfRate) {
      const pfWage = Math.min(grossEarnings, Number(pfRate.wageCeilingMonthly));
      pfEmployee = round(pfWage * (Number(pfRate.employeeContributionRate) / 100));
    }

    const esiApplicable = jobInfo?.esiApplicable ?? false;
    let esiEligible = false;
    if (esiApplicable && esiRate) {
      const esiWageCeiling = Number(esiRate.wageCeilingMonthly);
      if (Number(revision.grossSalary) <= esiWageCeiling) {
        // Condition 1: their structured (un-prorated) monthly salary is
        // already at/under the ceiling — the common case.
        esiEligible = true;
      } else if (grossEarnings <= esiWageCeiling) {
        // Condition 2: structured salary is above the ceiling, but this
        // month's actual LOP-adjusted gross alone still falls at/under it
        // (e.g. a heavy-LOP month) — still ESI-eligible for this month.
        esiEligible = true;
      }
    }
    // Either way the deduction itself is computed on the actual gross
    // earned this month, never the structured salary.
    const esiEmployee = esiEligible && esiRate ? round(grossEarnings * (Number(esiRate.employeeContributionRate) / 100)) : 0;

    const ptApplicable = jobInfo?.professionalTaxApplicable ?? false;
    let professionalTax = 0;
    if (ptApplicable) {
      const slab = ptSlabs.find(
        (s) => grossEarnings >= Number(s.minSalary) && (s.maxSalary === null || grossEarnings <= Number(s.maxSalary))
      );
      professionalTax = slab ? Number(slab.monthlyAmount) : 0;
    }

    const tdsSlab = tdsSlabs.find(
      (s) => grossEarnings >= Number(s.minSalary) && (s.maxSalary === null || grossEarnings <= Number(s.maxSalary))
    );
    const tds = tdsSlab ? round(grossEarnings * (Number(tdsSlab.ratePercent) / 100)) : 0;

    // Ad-hoc entries survive recalculation — read what's already there.
    const existingAdhoc = await prisma.payrollLineComponent.findMany({
      where: { payrollLineId: line.id, isAdhoc: true },
      include: { salaryComponent: { select: { type: true } } },
    });
    const otherEarningsTotal = round(
      existingAdhoc.filter((c) => c.salaryComponent.type === 'earning').reduce((sum, c) => sum + Number(c.amount), 0)
    );
    const otherDeductionsFromAdhoc = round(
      existingAdhoc.filter((c) => c.salaryComponent.type === 'deduction').reduce((sum, c) => sum + Number(c.amount), 0)
    );
    const otherDeductionsTotal = recurringDeductions + otherDeductionsFromAdhoc;

    const netSalary = round(
      grossEarnings + otAmount + otherEarningsTotal - pfEmployee - esiEmployee - professionalTax - tds - otherDeductionsTotal
    );

    await prisma.$transaction([
      prisma.payrollLineComponent.deleteMany({ where: { payrollLineId: line.id, isAdhoc: false } }),
      ...newComponentRows.map((c) =>
        prisma.payrollLineComponent.create({
          data: { payrollLineId: line.id, salaryComponentId: c.salaryComponentId, amount: c.amount, isAdhoc: false },
        })
      ),
      ...(pfComponent && pfEmployee > 0
        ? [
            prisma.payrollLineComponent.create({
              data: { payrollLineId: line.id, salaryComponentId: pfComponent.id, amount: pfEmployee, isAdhoc: false },
            }),
          ]
        : []),
      ...(esiComponent && esiEmployee > 0
        ? [
            prisma.payrollLineComponent.create({
              data: { payrollLineId: line.id, salaryComponentId: esiComponent.id, amount: esiEmployee, isAdhoc: false },
            }),
          ]
        : []),
      prisma.payrollLine.update({
        where: { id: line.id },
        data: {
          totalWorkingDays: summary.totalWorkingDays,
          payableDays,
          lopDays: summary.lopDays,
          grossEarnings,
          otAmount,
          otherEarningsTotal,
          pfEmployee,
          esiEmployee,
          professionalTax,
          tds,
          otherDeductionsTotal,
          netSalary,
          esiApplicable,
          ptApplicable,
          status: 'OK',
          holdReason: null,
        },
      }),
    ]);
    calculated++;
  }

  await prisma.payrollRun.update({
    where: { id: payrollRunId },
    data: { status: 'CALCULATED', calculatedAt: now },
  });

  return { calculated, onHold };
}
