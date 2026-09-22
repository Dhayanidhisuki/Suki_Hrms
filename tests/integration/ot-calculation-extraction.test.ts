/**
 * Equivalence gate for the computeEmployeeOtForMonth() extraction.
 *
 * The OT pipeline used to live inline inside calculatePayrollRun. Moving it
 * into src/lib/payroll/otCalculation.ts touches payroll's live calculation
 * path, so before any report is allowed to depend on the shared function we
 * prove it is output-identical to the code it replaced.
 *
 * `legacyComputeOt` below is the pre-extraction block transcribed verbatim
 * (git show HEAD:src/lib/payrollCalculation.ts, lines 336-483). Both
 * implementations are run over the same live rows for every employee/month
 * that already has a PayrollLine, and every output must match exactly.
 *
 * Read-only: this test issues no writes. It must stay that way — see the
 * IDENTITY incident note in prisma/migrations/.../DO_NOT_APPLY.md.
 */

import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/prisma';
import { applyMonthlyOtCap, computeOtPayableMinutes, parseShiftTime } from '@/lib/attendanceCalc';
import { computeEmployeeOtForMonth } from '@/lib/payroll/otCalculation';

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// ── Verbatim pre-extraction implementation ──────────────────────────────
function getIsoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-${String(weekNum).padStart(2, '0')}`;
}
const round = (n: number) => Math.round(n);

/* eslint-disable @typescript-eslint/no-explicit-any */
async function legacyComputeOt(
  emp: any, jobInfo: any, revision: any, year: number, month: number,
  lopFactor: number, totalWorkingDays: number, otPlans: any[], otIncentiveSlabs: any[]
): Promise<{ otAmount: number; otIncentiveAmount: number; totalOtHours: number }> {
  let otAmount = 0;
  let otIncentiveAmount = 0;
  let totalOtHours = 0;
  if (jobInfo?.overtimeAllowed) {
    const otPlan = otPlans.find((p) => p.isActive) ?? null;
    const otPlanLite = otPlan
      ? { applicableAfterMinutes: otPlan.applicableAfterMinutes, maxOtHoursPerDay: otPlan.maxOtHoursPerDay, roundingSlabMinutes: otPlan.roundingSlabMinutes }
      : null;

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 1));
    const dailyOtRows = await prisma.dailyAttendance.findMany({
      where: {
        employeeId: emp.id,
        date: { gte: monthStart, lt: monthEnd },
        status: { in: ['Present', 'HalfDay', 'OnDuty'] },
        OR: [
          { otMinutesApproved: { gt: 0 }, otApprovalStatus: 'approved', otSettlementType: 'OT' },
          { otApprovalStatus: null, otMinutesCalculated: { gt: 0 } },
        ],
      },
      include: { shiftMaster: { select: { endTime: true } } },
    });

    const otBasis = otPlan?.otCalculationBasis ?? 'GROSS';
    let otHourlyRate: number;
    if (otBasis === 'FIXED' && jobInfo.overtimeRatePerHour) {
      otHourlyRate = Number(jobInfo.overtimeRatePerHour);
    } else {
      const componentSum = (codes: string[]) =>
        revision.components
          .filter((c: any) => codes.includes(c.salaryComponent.code) && c.salaryComponent.type === 'earning')
          .reduce((sum: number, c: any) => sum + Number(c.amount) * lopFactor, 0);
      let basisAmount: number;
      if (otBasis === 'BASIC') basisAmount = componentSum(['BASIC']);
      else if (otBasis === 'BASIC_DA') basisAmount = componentSum(['BASIC', 'DA']);
      else if (otBasis === 'BASIC_DA_HRA') basisAmount = componentSum(['BASIC', 'DA', 'HRA']);
      else basisAmount = Number(revision.grossSalary);
      otHourlyRate = totalWorkingDays > 0 ? basisAmount / totalWorkingDays / 8 : 0;
    }

    const baseFactor = otPlan ? Number(otPlan.otRateMultiplier) : Number(jobInfo.overtimeFactor ?? 1);
    let totalOtAmount = 0;
    const weeklyOtHours = new Map<string, number>();
    for (const d of dailyOtRows) {
      const isApprovedOt = d.otApprovalStatus === 'approved' && d.otSettlementType === 'OT';
      if (!isApprovedOt && d.otApprovalStatus !== null) continue;
      const rawOtMinutes = isApprovedOt ? Number(d.otMinutesApproved ?? 0) : Number(d.otMinutesCalculated ?? 0);
      const shiftEndTod = d.shiftMaster ? parseShiftTime(d.shiftMaster.endTime) : undefined;
      const dayOtMinutes = computeOtPayableMinutes(rawOtMinutes, otPlanLite, shiftEndTod);
      if (dayOtMinutes <= 0) continue;
      const dayOtHours = dayOtMinutes / 60;
      let dayFactor = baseFactor;
      if (d.isHolidayWorked && otPlan?.holidayFactor) dayFactor = baseFactor * Number(otPlan.holidayFactor);
      else if (d.isWeeklyOffWorked && otPlan?.weeklyOffFactor) dayFactor = baseFactor * Number(otPlan.weeklyOffFactor);
      else if (otPlan?.weekdayFactor) dayFactor = baseFactor * Number(otPlan.weekdayFactor);
      totalOtAmount += dayOtHours * otHourlyRate * dayFactor;
      totalOtHours += dayOtHours;
      const weekKey = getIsoWeekKey(d.date);
      weeklyOtHours.set(weekKey, (weeklyOtHours.get(weekKey) ?? 0) + dayOtHours);
    }

    if (otPlan?.maxOtHoursPerWeek != null && weeklyOtHours.size > 0) {
      const weeklyCap = otPlan.maxOtHoursPerWeek;
      let cappedTotalHours = 0, scaleTotal = 0, scaleCapped = 0;
      for (const [, weekHours] of weeklyOtHours) {
        if (weekHours > weeklyCap) { scaleTotal += weekHours; scaleCapped += weeklyCap; cappedTotalHours += weeklyCap; }
        else cappedTotalHours += weekHours;
      }
      if (scaleTotal > scaleCapped) {
        totalOtAmount = totalOtAmount * (cappedTotalHours / totalOtHours);
        totalOtHours = cappedTotalHours;
      }
    }

    ({ totalOtHours, totalOtAmount } = applyMonthlyOtCap(totalOtHours, totalOtAmount, otPlan?.maxOtHoursPerMonth));
    otAmount = totalOtAmount;

    if (otIncentiveSlabs.length > 0 && totalOtHours > 0) {
      const slab = otIncentiveSlabs.find(
        (s) => totalOtHours >= Number(s.minOtHours) && (s.maxOtHours === null || totalOtHours < Number(s.maxOtHours))
      );
      if (slab?.flatBonusAmount != null) otIncentiveAmount = round(Number(slab.flatBonusAmount));
      else if (slab) otAmount *= Number(slab.incentiveMultiplier);
    }
    otAmount = round(otAmount);
  }
  return { otAmount, otIncentiveAmount, totalOtHours };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('computeEmployeeOtForMonth extraction', () => {
  it('produces byte-identical OT output to the pre-extraction implementation', async () => {
    const runs = await prisma.payrollRun.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }] });
    expect(runs.length, 'no payroll runs in the DB to verify against').toBeGreaterThan(0);

    let compared = 0;
    let withOt = 0;
    const mismatches: string[] = [];
    const storedDrift: string[] = [];

    for (const run of runs) {
      const { companyId, year, month } = run;
      const totalWorkingDays = daysInMonth(year, month);

      const [otPlans, otIncentiveSlabs, lines] = await Promise.all([
        prisma.oTPlan.findMany({ where: { isActive: true, deletedAt: null } }),
        prisma.oTIncentiveSlab.findMany({ where: { companyId, isActive: true, effectiveTo: null } }),
        prisma.payrollLine.findMany({ where: { payrollRunId: run.id }, select: { employeeId: true, otAmount: true, otIncentiveAmount: true, status: true } }),
      ]);
      if (lines.length === 0) continue;

      const employees = await prisma.employee.findMany({
        where: { id: { in: lines.map((l) => l.employeeId) } },
        select: {
          id: true,
          employeeCode: true,
          salaryRevisions: {
            where: { effectiveTo: null }, take: 1,
            select: { grossSalary: true, components: { select: { amount: true, salaryComponent: { select: { code: true, type: true } } } } },
          },
          jobInfos: {
            where: { effectiveTo: null }, take: 1,
            select: { overtimeAllowed: true, overtimeFactor: true, overtimeRatePerHour: true },
          },
        },
      });

      const lineByEmp = new Map(lines.map((l) => [l.employeeId, l]));

      for (const emp of employees) {
        const revision = emp.salaryRevisions[0];
        const jobInfo = emp.jobInfos[0];
        if (!revision) continue;

        const summary = await prisma.monthlyAttendanceSummary.findUnique({
          where: { employeeId_year_month: { employeeId: emp.id, year, month } },
        });
        if (!summary || summary.status === 'OPEN') continue;

        const payableDays = Number(summary.payableDays ?? (summary.totalWorkingDays - Number(summary.lopDays)));
        const totalDays = summary.totalWorkingDays > 0 ? summary.totalWorkingDays : totalWorkingDays;
        const lopFactor = totalDays > 0 ? Math.min(1, Math.max(0, payableDays / totalDays)) : 0;

        const legacy = await legacyComputeOt(emp, jobInfo, revision, year, month, lopFactor, totalWorkingDays, otPlans, otIncentiveSlabs);
        const shared = await computeEmployeeOtForMonth({
          employeeId: emp.id, year, month, jobInfo, revision,
          lopFactor, totalWorkingDays, otPlans, otIncentiveSlabs,
        });

        compared++;
        if (legacy.totalOtHours > 0) withOt++;

        const where = `${run.year}-${String(run.month).padStart(2, '0')} ${emp.employeeCode}`;
        if (legacy.otAmount !== shared.otAmount) mismatches.push(`${where}: otAmount legacy=${legacy.otAmount} shared=${shared.otAmount}`);
        if (legacy.otIncentiveAmount !== shared.otIncentiveAmount) mismatches.push(`${where}: otIncentive legacy=${legacy.otIncentiveAmount} shared=${shared.otIncentiveAmount}`);
        if (Math.abs(legacy.totalOtHours - shared.totalOtHours) > 1e-9) mismatches.push(`${where}: otHours legacy=${legacy.totalOtHours} shared=${shared.totalOtHours}`);

        // Informational only — a gap here means attendance changed since the
        // run was calculated, not that the extraction is wrong.
        const stored = lineByEmp.get(emp.id);
        if (stored && stored.status === 'OK' && Number(stored.otAmount) !== shared.otAmount) {
          storedDrift.push(`${where}: stored=${Number(stored.otAmount)} recomputed=${shared.otAmount}`);
        }
      }
    }

    console.log(`[ot-extraction] compared ${compared} employee-months across ${runs.length} run(s); ${withOt} with nonzero OT`);
    console.log(`[ot-extraction] stored-vs-recomputed differences (informational): ${storedDrift.length}`);
    for (const d of storedDrift.slice(0, 10)) console.log(`  ${d}`);

    expect(mismatches, `extraction changed OT output:\n${mismatches.slice(0, 20).join('\n')}`).toEqual([]);
    expect(compared, 'no employee-months were actually compared').toBeGreaterThan(0);
  }, 300_000);
});
