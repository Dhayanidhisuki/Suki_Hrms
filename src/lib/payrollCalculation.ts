/**
 * Payroll Processing — calculation engine.
 *
 * Reads: the employee's current EmployeeSalaryRevision (effectiveTo: null)
 * + its EmployeeSalaryComponent rows (NOT EmployeeCtc — zero consumers,
 * explicitly forbids invented formulas; NOT the legacy SalaryStructure),
 * that period's MonthlyAttendanceSummary, JobInfo's eligibility flags, and
 * the current (effectiveTo: null) PfRate/EsiRate/ProfessionalTaxSlab/
 * TDSSlab.
 *
 * Dynamic config wiring (2026-09-11):
 * - PF wage base: sums only SalaryComponent rows where includeInPf = true.
 *   Falls back to full gross when no component is flagged (preserves the
 *   Phase 1 behavior for catalogs that haven't been configured yet).
 * - ESI wage base: same convention using includeInEsi.
 * - OT threshold: OTPlan.applicableAfterMinutes is subtracted before
 *   computing OT hours; OTPlan.maxOtHoursPerDay caps daily OT (monthly
 *   total is the sum of daily-capped hours). OTPlan.payComponentId, when
 *   set, replaces the default "OT Pay" catalog component on the payslip.
 * - Canteen / benefit rates: BenefitRateByEmployeeType rows for the
 *   employee's current EmployeeType are auto-applied as system-generated
 *   (isAdhoc: false) PayrollLineComponent rows, prorated for deductions by
 *   the same lopFactor used for recurring components. This replaces the
 *   separate apply-benefit-rates endpoint as the default path; that
 *   endpoint remains for manual re-application.
 * - DeductionRate: active PERCENT/FLAT rates are auto-applied as
 *   system-generated deduction components. isLop = true rates are
 *   prorated by lopFactor (the LOP deduction itself); others are flat.
 * - LOM: lateMinutesTotal + earlyOutMinutesTotal from the attendance
 *   summary are converted to a currency deduction using a default
 *   (gross / totalWorkingDays / 8 / 60) × lomMinutes formula. This is
 *   intentionally a placeholder until the LomConfig master (Phase 2A.1)
 *   makes the basis/multiplier/denominator configurable.
 *
 * Documented simplifications still pending (Phase 2+):
 * - LOP proration is applied uniformly to every recurring earning/deduction
 *   component (lopFactor = payableDays / totalWorkingDays), not per-component
 *   rules.
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

// Phase 18 — ISO week key (Monday-Sunday) for weekly OT aggregation.
// Returns "YYYY-WW" where WW is the ISO week number.
function getIsoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-${String(weekNum).padStart(2, '0')}`;
}

function round(n: number) {
  return Math.round(n);
}

/** Apply configurable rounding mode to a salary amount. */
function applyRounding(amount: number, mode: string): number {
  switch (mode) {
    case 'NONE': return amount;
    case 'NEAREST_1': return Math.round(amount);
    case 'NEAREST_5': return Math.round(amount / 5) * 5;
    case 'NEAREST_10': return Math.round(amount / 10) * 10;
    case 'NEAREST_100': return Math.round(amount / 100) * 100;
    default: return Math.round(amount);
  }
}

export async function calculatePayrollRun(payrollRunId: number) {
  const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id: payrollRunId } });
  const { companyId, year, month } = run;
  const totalWorkingDays = daysInMonth(year, month);
  const now = new Date();

  const [employees, pfRate, esiRate, ptSlabs, tdsSlabs, otPlans, benefitRates, deductionRates, lomConfig, roundingConfig, validationConfig, otIncentiveSlabs, attendanceBonusConfig, lwfRates, healthInsuranceConfig, incentivePolicies, allowanceConfigs, statePtConfigs, licDeductionConfig] = await Promise.all([
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
            components: {
              select: {
                amount: true,
                salaryComponent: {
                  select: { id: true, type: true, code: true, includeInPf: true, includeInEsi: true },
                },
              },
            },
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
            pfRestrictionAmount: true,
            employeeTypeId: true,
            unitId: true,
            wageType: true,
          },
        },
      },
    }),
    prisma.pfRate.findFirst({ where: { effectiveTo: null, isActive: true } }),
    prisma.esiRate.findFirst({ where: { effectiveTo: null, isActive: true } }),
    prisma.professionalTaxSlab.findMany({ where: { effectiveTo: null, isActive: true } }),
    prisma.tDSSlab.findMany({ where: { effectiveTo: null, isActive: true } }),
    prisma.oTPlan.findMany({ where: { isActive: true, deletedAt: null } }),
    prisma.benefitRateByEmployeeType.findMany({
      where: { companyId, isActive: true },
      include: { salaryComponent: { select: { id: true, type: true, code: true } } },
    }),
    prisma.deductionRate.findMany({ where: { companyId, isActive: true, effectiveTo: null } }),
    prisma.lomConfig.findUnique({ where: { companyId } }),
    prisma.roundingConfig.findUnique({ where: { companyId } }),
    prisma.payrollValidationConfig.findUnique({ where: { companyId } }),
    prisma.oTIncentiveSlab.findMany({ where: { companyId, isActive: true, effectiveTo: null } }),
    prisma.attendanceBonusConfig.findUnique({ where: { companyId } }),
    prisma.lwfRate.findMany({ where: { companyId, isActive: true, effectiveTo: null } }),
    prisma.healthInsuranceConfig.findUnique({ where: { companyId } }),
    // Phase 15 — incentive policies and allowance configs.
    prisma.incentivePolicy.findMany({ where: { companyId, isActive: true } }),
    prisma.allowanceConfig.findMany({ where: { companyId, isActive: true } }),
    // Phase 17 — state PT configs and LIC deduction config.
    prisma.statePtConfig.findMany({ where: { companyId, isActive: true, effectiveTo: null } }),
    prisma.licDeductionConfig.findUnique({ where: { companyId } }),
  ]);

  // Index benefit rates by employeeTypeId for O(1) lookup per employee.
  const benefitRatesByType = new Map<number, typeof benefitRates>();
  for (const r of benefitRates) {
    const list = benefitRatesByType.get(r.employeeTypeId) ?? [];
    list.push(r);
    benefitRatesByType.set(r.employeeTypeId, list);
  }

  // Well-known catalog components used for itemized PF/ESI payslip lines —
  // isSystemDefined, so every company's catalog is guaranteed to have them
  // (seeded by bootstrap-admin via src/lib/defaultSalaryComponents.ts).
  const [pfComponent, esiComponent, otComponent, lomComponent] = await Promise.all([
    prisma.salaryComponent.findUnique({ where: { companyId_code: { companyId, code: 'PF' } } }),
    prisma.salaryComponent.findUnique({ where: { companyId_code: { companyId, code: 'ESI' } } }),
    prisma.salaryComponent.findUnique({ where: { companyId_code: { companyId, code: 'OT_PAY' } } }),
    prisma.salaryComponent.findUnique({ where: { companyId_code: { companyId, code: 'LOM' } } }),
  ]);

  // Resolve the OT component: prefer the OTPlan's configured payComponent,
  // fall back to the catalog OT_PAY component, fall back to null (OT amount
  // is still added to grossEarnings/otAmount, just not itemized on the
  // payslip as its own line).
  const resolvedOtComponent = otPlans.find((p) => p.payComponentId)?.payComponentId
    ? await prisma.salaryComponent.findUnique({ where: { id: otPlans.find((p) => p.payComponentId)!.payComponentId! } })
    : otComponent;

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

    const payableDays = Number(summary.payableDays ?? (summary.totalWorkingDays - Number(summary.lopDays)));
    const totalDays = summary.totalWorkingDays > 0 ? summary.totalWorkingDays : totalWorkingDays;
    const lopFactor = totalDays > 0 ? Math.min(1, Math.max(0, payableDays / totalDays)) : 0;

    let grossEarnings = 0;
    let recurringDeductions = 0;
    const newComponentRows: { salaryComponentId: number; amount: number }[] = [];

    // Phase 17 — wageType handling. For hourly/daily employees, the
    // salary components are per-period rates (hourly/daily), so multiply
    // by payable days (daily) or payable days × 8 (hourly) instead of
    // prorating by lopFactor.
    const wageType = jobInfo?.wageType ?? 'monthly';
    const isHourly = wageType === 'hourly';
    const isDaily = wageType === 'daily';

    for (const c of revision.components) {
      let proratedAmount: number;
      if (isHourly) {
        // Hourly rate × payable hours (payableDays × 8).
        proratedAmount = Number(c.amount) * payableDays * 8;
      } else if (isDaily) {
        // Daily rate × payable days.
        proratedAmount = Number(c.amount) * payableDays;
      } else {
        // Monthly rate prorated by LOP factor.
        proratedAmount = Number(c.amount) * lopFactor;
      }
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
      const otPlan = otPlans.find((p) => p.isActive) ?? null;
      const thresholdMinutes = otPlan?.applicableAfterMinutes ?? 0;

      // Phase 13 — per-day OT calculation with day-type factors.
      // Load DailyAttendance rows for this employee/month to apply
      // weekday/weeklyOff/holiday factors per day.
      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      const monthEnd = new Date(Date.UTC(year, month, 1));
      const dailyOtRows = await prisma.dailyAttendance.findMany({
        where: {
          employeeId: emp.id,
          date: { gte: monthStart, lt: monthEnd },
          otApprovalStatus: 'approved',
          otSettlementType: 'OT',
          otMinutesApproved: { gt: 0 },
        },
      });

      // Compute the OT hourly rate based on the configured basis.
      const otBasis = otPlan?.otCalculationBasis ?? 'GROSS';
      let otHourlyRate: number;
      if (otBasis === 'FIXED' && jobInfo.overtimeRatePerHour) {
        otHourlyRate = Number(jobInfo.overtimeRatePerHour);
      } else {
        const componentSum = (codes: string[]) =>
          revision.components
            .filter((c) => codes.includes(c.salaryComponent.code) && c.salaryComponent.type === 'earning')
            .reduce((sum, c) => sum + Number(c.amount) * lopFactor, 0);
        let basisAmount: number;
        if (otBasis === 'BASIC') {
          basisAmount = componentSum(['BASIC']);
        } else if (otBasis === 'BASIC_DA') {
          basisAmount = componentSum(['BASIC', 'DA']);
        } else if (otBasis === 'BASIC_DA_HRA') {
          basisAmount = componentSum(['BASIC', 'DA', 'HRA']);
        } else {
          basisAmount = Number(revision.grossSalary); // GROSS
        }
        otHourlyRate = totalWorkingDays > 0 ? basisAmount / totalWorkingDays / 8 : 0;
      }

      // Apply per-day factors: each day's OT minutes are multiplied by the
      // appropriate factor (weekday/weeklyOff/holiday) from the OTPlan.
      const baseFactor = otPlan ? Number(otPlan.otRateMultiplier) : Number(jobInfo.overtimeFactor ?? 1);
      let totalOtAmount = 0;
      let totalOtHours = 0;
      // Phase 18 — weekly OT aggregation for weekly cap enforcement.
      // Group OT hours by ISO week (Monday-Sunday).
      const weeklyOtHours = new Map<string, number>();
      for (const d of dailyOtRows) {
        const dayOtMinutes = Math.max(0, Number(d.otMinutesApproved ?? 0) - thresholdMinutes);
        if (dayOtMinutes <= 0) continue;
        const dayOtHours = dayOtMinutes / 60;
        let dayFactor = baseFactor;
        if (d.isHolidayWorked && otPlan?.holidayFactor) {
          dayFactor = baseFactor * Number(otPlan.holidayFactor);
        } else if (d.isWeeklyOffWorked && otPlan?.weeklyOffFactor) {
          dayFactor = baseFactor * Number(otPlan.weeklyOffFactor);
        } else if (otPlan?.weekdayFactor) {
          dayFactor = baseFactor * Number(otPlan.weekdayFactor);
        }
        totalOtAmount += dayOtHours * otHourlyRate * dayFactor;
        totalOtHours += dayOtHours;
        // Aggregate by week.
        const weekKey = getIsoWeekKey(d.date);
        weeklyOtHours.set(weekKey, (weeklyOtHours.get(weekKey) ?? 0) + dayOtHours);
      }

      // Phase 18 — Apply weekly cap from OTPlan when set.
      // If any week exceeds the cap, scale down that week's contribution.
      if (otPlan?.maxOtHoursPerWeek != null && weeklyOtHours.size > 0) {
        const weeklyCap = otPlan.maxOtHoursPerWeek;
        let cappedTotalHours = 0;
        let scaleTotal = 0;
        let scaleCapped = 0;
        for (const [, weekHours] of weeklyOtHours) {
          if (weekHours > weeklyCap) {
            scaleTotal += weekHours;
            scaleCapped += weeklyCap;
            cappedTotalHours += weeklyCap;
          } else {
            cappedTotalHours += weekHours;
          }
        }
        if (scaleTotal > scaleCapped) {
          // Scale the total OT amount proportionally.
          totalOtAmount = totalOtAmount * (cappedTotalHours / totalOtHours);
          totalOtHours = cappedTotalHours;
        }
      }

      // Apply daily cap (maxOtHoursPerDay × totalWorkingDays as monthly ceiling).
      const maxMonthlyHours = otPlan?.maxOtHoursPerDay != null
        ? otPlan.maxOtHoursPerDay * totalDays
        : null;
      if (maxMonthlyHours != null) {
        totalOtHours = Math.min(totalOtHours, maxMonthlyHours);
      }
      // Apply monthly cap from OTPlan when set.
      if (otPlan?.maxOtHoursPerMonth != null) {
        totalOtHours = Math.min(totalOtHours, otPlan.maxOtHoursPerMonth);
      }

      otAmount = totalOtAmount;

      // Apply OT incentive slab multiplier when configured.
      if (otIncentiveSlabs.length > 0 && totalOtHours > 0) {
        const slab = otIncentiveSlabs.find(
          (s) => totalOtHours >= Number(s.minOtHours) && (s.maxOtHours === null || totalOtHours < Number(s.maxOtHours))
        );
        if (slab) {
          otAmount *= Number(slab.incentiveMultiplier);
        }
      }
      otAmount = round(otAmount);
    }

    const pfApplicable = line.pfApplicable; // per-line override, default true, editable before approval
    let pfEmployee = 0;
    let pfEmployer = 0;
    let epsEmployer = 0;
    if (pfApplicable && pfRate) {
      // "Employee PF Cont. Customize" (legacy screen) — a per-employee cap
      // below the statutory wage ceiling, e.g. PF restricted to 15000 even
      // though actual gross is higher. Read from JobInfo.pfRestrictionAmount
      // when the admin has set one; otherwise only the statutory ceiling applies.
      const pfWageCap = jobInfo?.pfRestrictionAmount != null
        ? Math.min(Number(pfRate.wageCeilingMonthly), Number(jobInfo.pfRestrictionAmount))
        : Number(pfRate.wageCeilingMonthly);
      // PF wage base: sum only components flagged includeInPf = true. Falls
      // back to full gross when no component is flagged, preserving the
      // Phase 1 behavior for catalogs that haven't been configured yet.
      const pfFlagged = revision.components.filter(
        (c) => c.salaryComponent.type === 'earning' && c.salaryComponent.includeInPf
      );
      const pfWageBase = pfFlagged.length > 0
        ? pfFlagged.reduce((sum, c) => sum + Number(c.amount) * lopFactor, 0)
        : grossEarnings;
      const pfWage = Math.min(pfWageBase, pfWageCap);
      pfEmployee = round(pfWage * (Number(pfRate.employeeContributionRate) / 100));
      // Employer: total employerContributionRate (12%) split into EPF (3.67%) + EPS (8.33%)
      const employerRate = Number(pfRate.employerContributionRate) / 100;
      const epsRate = Number(pfRate.pensionContributionRate ?? 8.33) / 100;
      const pfEmployerTotal = round(pfWage * employerRate);
      epsEmployer = round(pfWage * epsRate);
      pfEmployer = pfEmployerTotal - epsEmployer;
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
    // ESI wage base: sum only components flagged includeInEsi = true. Falls
    // back to full gross when no component is flagged, preserving the
    // Phase 1 behavior for catalogs that haven't been configured yet.
    const esiFlagged = revision.components.filter(
      (c) => c.salaryComponent.type === 'earning' && c.salaryComponent.includeInEsi
    );
    const esiWageBase = esiFlagged.length > 0
      ? esiFlagged.reduce((sum, c) => sum + Number(c.amount) * lopFactor, 0)
      : grossEarnings;
    // Either way the deduction itself is computed on the actual gross
    // earned this month, never the structured salary.
    const esiEmployee = esiEligible && esiRate ? round(esiWageBase * (Number(esiRate.employeeContributionRate) / 100)) : 0;
    const esiEmployer = esiEligible && esiRate ? round(esiWageBase * (Number(esiRate.employerContributionRate) / 100)) : 0;

    const ptApplicable = jobInfo?.professionalTaxApplicable ?? false;
    let professionalTax = 0;
    if (ptApplicable) {
      // Phase 17 — state-wise PT: if StatePtConfig maps the employee's
      // work state to a specific slab code, use that slab; otherwise fall
      // back to the global ptSlabs lookup.
      let stateSlabCode: string | null = null;
      if (jobInfo?.unitId && statePtConfigs.length > 0) {
        const unit = await prisma.unit.findUnique({
          where: { id: jobInfo.unitId },
          select: { state: true },
        });
        if (unit?.state) {
          const stateConfig = statePtConfigs.find((c) => c.state === unit.state);
          if (stateConfig) stateSlabCode = stateConfig.slabCode;
        }
      }
      const slabPool = stateSlabCode
        ? ptSlabs.filter((s) => s.code === stateSlabCode)
        : ptSlabs;
      const slab = slabPool.find(
        (s) => grossEarnings >= Number(s.minSalary) && (s.maxSalary === null || grossEarnings <= Number(s.maxSalary))
      );
      professionalTax = slab ? Number(slab.monthlyAmount) : 0;
    }

    // Phase 17 — LIC deduction from LicDeductionConfig.
    let licDeduction = 0;
    if (licDeductionConfig?.isActive) {
      if (licDeductionConfig.deductionType === 'PERCENT') {
        licDeduction = round(grossEarnings * (Number(licDeductionConfig.amount) / 100));
      } else {
        licDeduction = round(Number(licDeductionConfig.amount));
      }
      if (Number(licDeductionConfig.minAmount) > 0) {
        licDeduction = Math.max(licDeduction, Number(licDeductionConfig.minAmount));
      }
      if (licDeductionConfig.maxAmount !== null) {
        licDeduction = Math.min(licDeduction, Number(licDeductionConfig.maxAmount));
      }
    }

    const tdsSlab = tdsSlabs.find(
      (s) => grossEarnings >= Number(s.minSalary) && (s.maxSalary === null || grossEarnings <= Number(s.maxSalary))
    );
    const tds = tdsSlab ? round(grossEarnings * (Number(tdsSlab.ratePercent) / 100)) : 0;

    // ── Auto-applied components (system-generated, isAdhoc: false) ───────
    // These are recalculated each run alongside the recurring salary
    // components. Ad-hoc entries (user-added) survive recalculation.
    const autoComponentRows: { salaryComponentId: number; amount: number }[] = [];

    // LWF (Labour Welfare Fund) — applied when the employee's work state
    // matches a configured LwfRate row. Frequency determines whether to
    // deduct this month (MONTHLY = always; HALF_YEARLY/YEARLY = only on
    // deductionMonth). Phase 2C uses a placeholder state resolution —
    // reads from JobInfo's Site state when available; defaults to the
    // first LWF row when no state can be resolved.
    let lwfAmount = 0;
    if (lwfRates.length > 0) {
      // TODO: resolve employee work state from JobInfo → Site.state.
      // For now, apply the first active LWF rate (single-state companies).
      const lwfRate = lwfRates[0];
      const appliesThisMonth = lwfRate.frequency === 'MONTHLY'
        ? true
        : lwfRate.deductionMonth === month;
      if (appliesThisMonth) {
        const empRate = lwfRate.rateType === 'PERCENT'
          ? round(grossEarnings * (Number(lwfRate.employeeRate) / 100))
          : round(Number(lwfRate.employeeRate));
        lwfAmount = empRate;
        if (lwfAmount > 0) {
          const lwfComp = await prisma.salaryComponent.findUnique({
            where: { companyId_code: { companyId, code: 'LWF' } },
          });
          if (lwfComp) {
            autoComponentRows.push({ salaryComponentId: lwfComp.id, amount: lwfAmount });
          }
        }
      }
    }

    // Health insurance — employee contribution as % of gross or flat premium.
    let healthInsuranceAmount = 0;
    if (healthInsuranceConfig?.isActive) {
      const empRate = round(grossEarnings * (Number(healthInsuranceConfig.employeeContributionRate) / 100));
      const flatPremium = round(Number(healthInsuranceConfig.monthlyPremium));
      healthInsuranceAmount = Math.max(empRate, flatPremium);
      if (healthInsuranceAmount > 0) {
        const hiComp = await prisma.salaryComponent.findUnique({
          where: { companyId_code: { companyId, code: 'HEALTH_INS' } },
        });
        if (hiComp) {
          autoComponentRows.push({ salaryComponentId: hiComp.id, amount: healthInsuranceAmount });
        }
      }
    }

    // Canteen / benefit rates by employee type — auto-applied. Deduction
    // rates (e.g. Canteen) are prorated by lopFactor; earning rates (e.g.
    // Petrol) are applied in full (BRD gave no proration rule for those).
    const employeeTypeId = jobInfo?.employeeTypeId;
    const applicableBenefitRates = employeeTypeId ? benefitRatesByType.get(employeeTypeId) ?? [] : [];
    for (const rate of applicableBenefitRates) {
      if (!rate.salaryComponent || !rate.salaryComponentId) continue;
      const isDeduction = rate.salaryComponent.type === 'deduction';
      const factor = isDeduction ? lopFactor : 1;
      const amount = round(Number(rate.amount) * factor);
      if (amount !== 0) {
        autoComponentRows.push({ salaryComponentId: rate.salaryComponentId, amount });
      }
    }

    // DeductionRate — active PERCENT/FLAT rates. isLop=true rates are
    // prorated by lopFactor (the LOP deduction itself); others are flat.
    for (const dr of deductionRates) {
      const amount = dr.deductionType === 'PERCENT'
        ? round(grossEarnings * (Number(dr.rateValue) / 100))
        : round(Number(dr.rateValue) * (dr.isLop ? lopFactor : 1));
      if (amount !== 0) {
        // DeductionRate has no salaryComponentId link — look up by code.
        const comp = await prisma.salaryComponent.findUnique({
          where: { companyId_code: { companyId, code: dr.code } },
        });
        if (comp) {
          autoComponentRows.push({ salaryComponentId: comp.id, amount });
        }
      }
    }

    // LOM (Loss of Minutes) — late + early minutes from attendance. Uses
    // LomConfig when the admin has configured it; otherwise falls back to
    // the default formula: (gross / totalWorkingDays / 8 / 60) × lomMinutes.
    const lomMinutesRaw = Number(summary.lateMinutesTotal ?? 0) + Number(summary.earlyOutMinutesTotal ?? 0);
    const graceExempt = lomConfig?.graceMinutesExempt ?? 0;
    const lomMinutes = Math.max(0, lomMinutesRaw - graceExempt);
    let lomAmount = 0;
    if (lomMinutes > 0 && grossEarnings > 0 && totalDays > 0) {
      const basis = lomConfig?.calculationBasis === 'BASIC'
        ? revision.components.filter((c) => c.salaryComponent.code === 'BASIC' && c.salaryComponent.type === 'earning')
            .reduce((sum, c) => sum + Number(c.amount) * lopFactor, 0)
        : grossEarnings;
      const shiftDuration = lomConfig?.shiftDurationSource === 'SHIFT_MASTER' ? 8 : 8; // Phase 2A.6 will read ShiftMaster
      const denom = lomConfig?.payrollDaysDenominator === 'FIXED_26' ? 26 : totalDays;
      const multiplier = lomConfig ? Number(lomConfig.multiplier) : 1;
      const perMinuteRate = basis / denom / shiftDuration / 60;
      lomAmount = round(perMinuteRate * lomMinutes * multiplier);
      if (lomComponent && lomAmount > 0) {
        autoComponentRows.push({ salaryComponentId: lomComponent.id, amount: lomAmount });
      }
    }

    // OT as its own payslip line (when a component is configured).
    if (resolvedOtComponent && otAmount > 0) {
      autoComponentRows.push({ salaryComponentId: resolvedOtComponent.id, amount: otAmount });
    }

    // Attendance bonus — auto-applied when configured and employee qualifies.
    // Qualification: zero LOP (if required), zero late (if required), zero
    // early-out (if required), and payable days >= min % of total days.
    let attendanceBonus = 0;
    if (attendanceBonusConfig?.isActive && Number(attendanceBonusConfig.bonusAmount) > 0) {
      const lopDays = Math.round(Number(summary.lopDays));
      const lateMin = Number(summary.lateMinutesTotal ?? 0);
      const earlyMin = Number(summary.earlyOutMinutesTotal ?? 0);
      const payablePercent = totalDays > 0 ? (Number(payableDays) / totalDays) * 100 : 0;
      const qualifies =
        (!attendanceBonusConfig.requiresZeroLop || lopDays === 0) &&
        (!attendanceBonusConfig.requiresZeroLate || lateMin === 0) &&
        (!attendanceBonusConfig.requiresZeroEarlyOut || earlyMin === 0) &&
        (payablePercent >= Number(attendanceBonusConfig.minPayableDaysPercent));
      if (qualifies) {
        attendanceBonus = Number(attendanceBonusConfig.bonusAmount);
        if (attendanceBonusConfig.prorateByPayableDays && totalDays > 0) {
          attendanceBonus = attendanceBonus * (Number(payableDays) / totalDays);
        }
        attendanceBonus = round(attendanceBonus);
        // Look up or create an ATT_BONUS component for the payslip line.
        const bonusComp = await prisma.salaryComponent.findUnique({
          where: { companyId_code: { companyId, code: 'ATT_BONUS' } },
        });
        if (bonusComp && attendanceBonus > 0) {
          autoComponentRows.push({ salaryComponentId: bonusComp.id, amount: attendanceBonus });
        }
      }
    }

    // Sum auto-applied earnings/deductions for net salary calculation.
    // Classify each auto row by its source to determine earning vs deduction.
    let autoEarningsTotal = 0;
    let autoDeductionsTotal = 0;
    for (const rate of applicableBenefitRates) {
      if (!rate.salaryComponent) continue;
      const isDeduction = rate.salaryComponent.type === 'deduction';
      const factor = isDeduction ? lopFactor : 1;
      const amount = round(Number(rate.amount) * factor);
      if (isDeduction) autoDeductionsTotal += amount;
      else autoEarningsTotal += amount;
    }
    for (const dr of deductionRates) {
      const amount = dr.deductionType === 'PERCENT'
        ? round(grossEarnings * (Number(dr.rateValue) / 100))
        : round(Number(dr.rateValue) * (dr.isLop ? lopFactor : 1));
      autoDeductionsTotal += amount;
    }
    autoDeductionsTotal += lomAmount;
    autoDeductionsTotal += lwfAmount;
    autoDeductionsTotal += healthInsuranceAmount;
    autoDeductionsTotal += licDeduction;

    // Loan EMI deduction — for each active loan of this employee, deduct the
    // next pending installment. The deduction is split into principal and
    // interest; only the total is added to autoDeductionsTotal. The loan's
    // running totals and installment status are updated by deductNextInstallment.
    let loanDeductionTotal = 0;
    const activeLoans = await prisma.loan.findMany({
      where: { employeeId: emp.id, status: 'active' },
      include: {
        installments: {
          where: { status: 'pending' },
          orderBy: { installmentNumber: 'asc' },
          take: 1,
        },
      },
    });
    for (const loan of activeLoans) {
      // Check if this installment is due this month.
      const installment = loan.installments[0];
      if (!installment) continue;
      const dueDate = new Date(installment.dueDate);
      if (dueDate.getUTCFullYear() !== year || dueDate.getUTCMonth() + 1 !== month) continue;

      const { deductNextInstallment } = await import('@/lib/loanCalculation');
      const result = await deductNextInstallment(loan.id, payrollRunId);
      if (result) {
        loanDeductionTotal += result.total;
        // Add as an auto-component row if a LOAN salary component exists.
        const loanComp = await prisma.salaryComponent.findUnique({
          where: { companyId_code: { companyId, code: 'LOAN' } },
        });
        if (loanComp) {
          autoComponentRows.push({ salaryComponentId: loanComp.id, amount: result.total });
        }
      }
    }
    autoDeductionsTotal += loanDeductionTotal;

    autoEarningsTotal += otAmount; // OT is an earning
    autoEarningsTotal += attendanceBonus; // Attendance bonus is an earning

    // ── Phase 9: Incentives & Allowances ───────────────────────────────
    // Canteen deduction — sum employee contributions for this month.
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 1));
    const canteenTokens = await prisma.canteenToken.findMany({
      where: { employeeId: emp.id, date: { gte: monthStart, lt: monthEnd } },
    });
    const canteenDeduction = canteenTokens.reduce((sum, t) => sum + Number(t.employeeContribution), 0);
    if (canteenDeduction > 0) {
      autoDeductionsTotal += canteenDeduction;
      const canteenComp = await prisma.salaryComponent.findUnique({
        where: { companyId_code: { companyId, code: 'CANTEEN' } },
      });
      if (canteenComp) {
        autoComponentRows.push({ salaryComponentId: canteenComp.id, amount: canteenDeduction });
      }
    }

    // Petrol allowance — sum approved entries for this month.
    const petrolEntries = await prisma.petrolAllowanceEntry.findMany({
      where: { employeeId: emp.id, year, month, status: 'APPROVED' },
    });
    const petrolAllowance = petrolEntries.reduce((sum, p) => sum + Number(p.approvedAmount), 0);
    if (petrolAllowance > 0) {
      autoEarningsTotal += petrolAllowance;
      const petrolComp = await prisma.salaryComponent.findUnique({
        where: { companyId_code: { companyId, code: 'PETROL' } },
      });
      if (petrolComp) {
        autoComponentRows.push({ salaryComponentId: petrolComp.id, amount: petrolAllowance });
      }
    }

    // Double machine incentive — sum approved entries for this month.
    const doubleMachineEntries = await prisma.doubleMachineEntry.findMany({
      where: {
        employeeId: emp.id,
        date: { gte: monthStart, lt: monthEnd },
        status: 'APPROVED',
      },
    });
    const doubleMachineIncentive = doubleMachineEntries.reduce((sum, d) => sum + Number(d.calculatedIncentive), 0);
    if (doubleMachineIncentive > 0) {
      autoEarningsTotal += doubleMachineIncentive;
      const dmComp = await prisma.salaryComponent.findUnique({
        where: { companyId_code: { companyId, code: 'DM_INCENTIVE' } },
      });
      if (dmComp) {
        autoComponentRows.push({ salaryComponentId: dmComp.id, amount: doubleMachineIncentive });
      }
    }

    // Phase 15 — Shift bonus from IncentivePolicy (SHIFT_BONUS type).
    for (const policy of incentivePolicies) {
      if (policy.type === 'SHIFT_BONUS' && policy.calculationType === 'FLAT') {
        const shiftCodes = (policy.eligibleShiftCodes ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        if (shiftCodes.length > 0) {
          const dmMonthStart = new Date(Date.UTC(year, month - 1, 1));
          const dmMonthEnd = new Date(Date.UTC(year, month, 1));
          const matchingDays = await prisma.dailyAttendance.count({
            where: {
              employeeId: emp.id,
              date: { gte: dmMonthStart, lt: dmMonthEnd },
              status: { in: ['Present', 'HalfDay', 'OnDuty'] },
              shiftMaster: { code: { in: shiftCodes } },
            },
          });
          if (matchingDays > 0) {
            const shiftBonus = round(Number(policy.amount));
            autoEarningsTotal += shiftBonus;
            const comp = await prisma.salaryComponent.findUnique({
              where: { companyId_code: { companyId, code: 'SHIFT_BONUS' } },
            });
            if (comp) autoComponentRows.push({ salaryComponentId: comp.id, amount: shiftBonus });
          }
        }
      }
    }

    // Phase 15 — AllowanceConfig (heat/night/snacks/food allowances).
    for (const cfg of allowanceConfigs) {
      let eligible = false;
      if (cfg.eligibilityType === 'ALL') {
        eligible = true;
      } else if (cfg.eligibilityType === 'SHIFT') {
        const eligibleIds = (cfg.eligibilityValue ?? '').split(',').map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));
        if (eligibleIds.length > 0) {
          const acMonthStart = new Date(Date.UTC(year, month - 1, 1));
          const acMonthEnd = new Date(Date.UTC(year, month, 1));
          const matchingDays = await prisma.dailyAttendance.count({
            where: {
              employeeId: emp.id,
              date: { gte: acMonthStart, lt: acMonthEnd },
              shiftMasterId: { in: eligibleIds },
              status: { in: ['Present', 'HalfDay', 'OnDuty'] },
            },
          });
          eligible = matchingDays > 0;
        }
      }
      // DESIGNATION and DEPARTMENT eligibility require jobInfo fields not
      // currently in the select — future enhancement.
      if (eligible) {
        const allowanceAmount = round(Number(cfg.amount) * lopFactor);
        autoEarningsTotal += allowanceAmount;
        const comp = await prisma.salaryComponent.findUnique({
          where: { companyId_code: { companyId, code: cfg.componentCode } },
        });
        if (comp) autoComponentRows.push({ salaryComponentId: comp.id, amount: allowanceAmount });
      }
    }

    autoEarningsTotal = round(autoEarningsTotal);
    autoDeductionsTotal = round(autoDeductionsTotal);

    // Ad-hoc entries survive recalculation — read what's already there.
    const existingAdhoc = await prisma.payrollLineComponent.findMany({
      where: { payrollLineId: line.id, isAdhoc: true },
      include: { salaryComponent: { select: { type: true } } },
    });
    const otherEarningsTotal = round(
      existingAdhoc.filter((c) => c.salaryComponent.type === 'earning').reduce((sum, c) => sum + Number(c.amount), 0) + autoEarningsTotal
    );
    const otherDeductionsFromAdhoc = round(
      existingAdhoc.filter((c) => c.salaryComponent.type === 'deduction').reduce((sum, c) => sum + Number(c.amount), 0)
    );
    const otherDeductionsTotal = round(recurringDeductions + otherDeductionsFromAdhoc + autoDeductionsTotal);

    let netSalary = round(
      grossEarnings + otAmount + otherEarningsTotal - pfEmployee - esiEmployee - professionalTax - tds - otherDeductionsTotal
    );

    // Apply configurable rounding (RoundingConfig). When no config exists,
    // round() above (Math.round) is the default — nearest 1.
    if (roundingConfig && roundingConfig.roundingMode !== 'NEAREST_1') {
      netSalary = applyRounding(netSalary, roundingConfig.roundingMode);
    }

    // Apply payroll validation (PayrollValidationConfig + Phase 11 engine).
    // When no config exists, all lines pass (no validation enforced).
    let lineStatus: 'OK' | 'HOLD' = 'OK';
    let holdReason: string | null = null;
    if (validationConfig) {
      // Gather component codes for duplicate check.
      const allComponentRows = [...newComponentRows, ...autoComponentRows];
      const componentCodes = allComponentRows.map((c) => {
        const comp = revision.components.find((rc) => rc.salaryComponent.id === c.salaryComponentId);
        return comp?.salaryComponent.code ?? '';
      }).filter(Boolean);

      // Load attendance summary status for this employee/month.
      const attendanceSummary = await prisma.monthlyAttendanceSummary.findFirst({
        where: { employeeId: emp.id, year, month },
        select: { status: true },
      });

      const { validatePayrollLine, determineLineStatus } = await import('@/lib/payrollValidation');
      const validationResults = validatePayrollLine(
        {
          employeeId: emp.id,
          employeeCode: String(emp.id),
          grossEarnings,
          totalDeductions: autoDeductionsTotal + otherDeductionsTotal,
          netSalary,
          otAmount,
          otMinutes: Number(summary.otMinutesTotal) ?? 0,
          lopDays: line.lopDays,
          payableDays: Number(line.payableDays),
          pfEmployee,
          esiEmployee,
          professionalTax,
          tds,
          otherDeductions: otherDeductionsTotal,
          attendanceStatus: attendanceSummary?.status ?? null,
          componentCodes,
        },
        {
          allowNegativeNet: validationConfig.allowNegativeNet,
          minNetPercentOfGross: Number(validationConfig.minNetPercentOfGross),
          maxDeductionPercent: Number(validationConfig.maxDeductionPercent),
          statutoryIncludedInLimit: validationConfig.statutoryIncludedInLimit,
          maxOtHoursPerMonth: validationConfig.maxOtHoursPerMonth ? Number(validationConfig.maxOtHoursPerMonth) : null,
          maxOtPercentOfGross: validationConfig.maxOtPercentOfGross ? Number(validationConfig.maxOtPercentOfGross) : null,
          checkGrossReconciliation: validationConfig.checkGrossReconciliation,
          maxLopDaysPerMonth: validationConfig.maxLopDaysPerMonth,
          checkAttendanceFrozen: validationConfig.checkAttendanceFrozen,
          checkDuplicateComponents: validationConfig.checkDuplicateComponents,
          minPayableDays: validationConfig.minPayableDays ? Number(validationConfig.minPayableDays) : null,
          warnIfZeroGross: validationConfig.warnIfZeroGross,
        }
      );
      const status = determineLineStatus(validationResults);
      lineStatus = status.status;
      holdReason = status.reason;
    }

    await prisma.$transaction([
      prisma.payrollLineComponent.deleteMany({ where: { payrollLineId: line.id, isAdhoc: false } }),
      ...newComponentRows.map((c) =>
        prisma.payrollLineComponent.create({
          data: { payrollLineId: line.id, salaryComponentId: c.salaryComponentId, amount: c.amount, isAdhoc: false },
        })
      ),
      ...autoComponentRows.map((c) =>
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
          totalWorkingDays: totalDays,
          payableDays,
          lopDays: Math.round(Number(summary.lopDays)),
          grossEarnings,
          otAmount,
          otherEarningsTotal,
          pfEmployee,
          pfEmployer,
          epsEmployer,
          esiEmployee,
          esiEmployer,
          professionalTax,
          tds,
          otherDeductionsTotal,
          lomAmount,
          lwfAmount,
          healthInsurance: healthInsuranceAmount,
          licAmount: licDeduction,
          netSalary,
          esiApplicable,
          ptApplicable,
          status: lineStatus,
          holdReason,
        },
      }),
    ]);
    if (lineStatus === 'HOLD') {
      onHold++;
    } else {
      calculated++;
    }
  }

  await prisma.payrollRun.update({
    where: { id: payrollRunId },
    data: { status: 'CALCULATED', calculatedAt: now },
  });

  return { calculated, onHold };
}
