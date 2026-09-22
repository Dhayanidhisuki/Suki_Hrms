/**
 * Overtime calculation — the single implementation shared by payroll and
 * the OT reports.
 *
 * Extracted verbatim from calculatePayrollRun (src/lib/payrollCalculation.ts)
 * so that reports can no longer drift from what payroll actually paid. The
 * reports used to re-derive OT from raw DailyAttendance rows with no status
 * filter and none of the threshold/rounding/cap logic below, which meant a
 * report column named "payable OT" could exceed the amount on the payslip.
 * There is now exactly one place the pipeline lives:
 *
 *   status filter (Present/HalfDay/OnDuty)
 *     → payable-row selection (approved-as-OT, or no approval decision)
 *     → computeOtPayableMinutes (threshold, rounding slab, daily cap)
 *     → per-day day-type factor (weekday / weeklyOff / holiday)
 *     → weekly cap → monthly cap
 *     → OTIncentiveSlab match on the POST-cap hours
 *
 * PayrollLine stores otAmount and otIncentiveAmount but not the post-cap
 * hours figure, so a report that needs "OT Hrs" has to call this rather
 * than read it back — hence `totalOtHours` and `days` on the result.
 */

import { prisma } from '@/lib/prisma';
import { applyMonthlyOtCap, computeOtPayableMinutes, parseShiftTime } from '@/lib/attendanceCalc';

/** Prisma Decimal, or anything Number() understands. */
type Numeric = number | { toString(): string };

export interface OtPlanLike {
  code?: string;
  name?: string;
  isActive: boolean;
  applicableAfterMinutes: number;
  maxOtHoursPerDay: number | null;
  roundingSlabMinutes?: number | null;
  otCalculationBasis?: string | null;
  otRateMultiplier: Numeric;
  weekdayFactor?: Numeric | null;
  weeklyOffFactor?: Numeric | null;
  holidayFactor?: Numeric | null;
  maxOtHoursPerWeek: number | null;
  maxOtHoursPerMonth: number | null;
}

export interface OtIncentiveSlabLike {
  code?: string;
  name?: string;
  minOtHours: Numeric;
  maxOtHours: Numeric | null;
  flatBonusAmount: Numeric | null;
  incentiveMultiplier: Numeric;
}

export interface OtJobInfoLike {
  overtimeAllowed: boolean | null;
  overtimeFactor?: Numeric | null;
  overtimeRatePerHour?: Numeric | null;
}

export interface OtRevisionLike {
  grossSalary: Numeric;
  components: Array<{
    amount: Numeric;
    salaryComponent: { code: string; type: string };
  }>;
}

/** One payable OT day, in the same terms payroll used to price it. */
export interface OtDayDetail {
  date: Date;
  /** Minutes on the row before threshold/rounding/daily cap. */
  rawOtMinutes: number;
  /** Minutes after computeOtPayableMinutes. */
  payableOtMinutes: number;
  payableOtHours: number;
  dayType: 'weekday' | 'weeklyOff' | 'holiday';
  /** baseFactor × the day-type factor — what this day's hours were priced at. */
  factorApplied: number;
  amount: number;
  isoWeek: string;
}

export interface EmployeeOtResult {
  /** Post-cap, post-slab-multiplier, rounded — identical to PayrollLine.otAmount. */
  otAmount: number;
  /** Flat OTIncentiveSlab bonus — identical to PayrollLine.otIncentiveAmount. */
  otIncentiveAmount: number;
  /** Post-cap OT hours — the figure the slab was matched on. Not stored on PayrollLine. */
  totalOtHours: number;
  /** Pre-cap OT hours, for showing how much a cap removed. */
  uncappedOtHours: number;
  otHourlyRate: number;
  baseFactor: number;
  otBasis: string;
  otPlan: OtPlanLike | null;
  matchedSlab: OtIncentiveSlabLike | null;
  /** Per-day breakdown, pre-cap (weekly/monthly caps scale the totals, not rows). */
  days: OtDayDetail[];
}

// ISO week key (Monday-Sunday), "YYYY-WW" — used for the weekly cap.
export function getIsoWeekKey(date: Date): string {
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

const EMPTY: EmployeeOtResult = {
  otAmount: 0,
  otIncentiveAmount: 0,
  totalOtHours: 0,
  uncappedOtHours: 0,
  otHourlyRate: 0,
  baseFactor: 0,
  otBasis: 'GROSS',
  otPlan: null,
  matchedSlab: null,
  days: [],
};

export interface ComputeEmployeeOtArgs {
  employeeId: number;
  year: number;
  month: number;
  jobInfo: OtJobInfoLike | null | undefined;
  revision: OtRevisionLike;
  /** Payable-days / total-days, already clamped to [0,1] by the caller. */
  lopFactor: number;
  /** daysInMonth(year, month) — payroll's divisor for the hourly rate. */
  totalWorkingDays: number;
  otPlans: OtPlanLike[];
  otIncentiveSlabs: OtIncentiveSlabLike[];
}

/**
 * Compute one employee's OT for one month. Returns zeros (and no days) when
 * the employee is not OT-eligible, exactly as payroll's `if
 * (jobInfo?.overtimeAllowed)` gate did.
 */
export async function computeEmployeeOtForMonth(
  args: ComputeEmployeeOtArgs
): Promise<EmployeeOtResult> {
  const {
    employeeId, year, month, jobInfo, revision,
    lopFactor, totalWorkingDays, otPlans, otIncentiveSlabs,
  } = args;

  // Gate on the per-employee eligibility flag only. summary.otMinutesTotal
  // is written as approved-only (monthly/finalize, refreshMonthlySummary),
  // so gating on it zeroed OT for sites with no OT approval workflow.
  // The row query below decides whether there is anything to pay.
  if (!jobInfo?.overtimeAllowed) return { ...EMPTY, days: [] };

  const otPlan = otPlans.find((p) => p.isActive) ?? null;
  const otPlanLite = otPlan
    ? { applicableAfterMinutes: otPlan.applicableAfterMinutes, maxOtHoursPerDay: otPlan.maxOtHoursPerDay, roundingSlabMinutes: otPlan.roundingSlabMinutes }
    : null;

  // Phase 13 — per-day OT calculation with day-type factors.
  // Two kinds of row are payable in cash:
  //   1. approved-as-OT rows → otMinutesApproved;
  //   2. rows with NO approval decision at all (otApprovalStatus null)
  //      → otMinutesCalculated (sites without the approval workflow).
  // Rejected rows and COMP_OFF settlements are never paid in cash — the
  // comp-off route credits a comp-off day and nulls otMinutesApproved
  // but leaves otMinutesCalculated untouched, so it must not be a
  // fallback here. Pending rows are paid once decided.
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const dailyOtRows = await prisma.dailyAttendance.findMany({
    where: {
      employeeId,
      date: { gte: monthStart, lt: monthEnd },
      status: { in: ['Present', 'HalfDay', 'OnDuty'] },
      OR: [
        { otMinutesApproved: { gt: 0 }, otApprovalStatus: 'approved', otSettlementType: 'OT' },
        { otApprovalStatus: null, otMinutesCalculated: { gt: 0 } },
      ],
    },
    include: { shiftMaster: { select: { endTime: true } } },
    orderBy: { date: 'asc' },
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
  const days: OtDayDetail[] = [];
  // Phase 18 — weekly OT aggregation for weekly cap enforcement.
  // Group OT hours by ISO week (Monday-Sunday).
  const weeklyOtHours = new Map<string, number>();
  for (const d of dailyOtRows) {
    const isApprovedOt = d.otApprovalStatus === 'approved' && d.otSettlementType === 'OT';
    // Mirror the query: approved-as-OT → approved minutes; undecided →
    // calculated minutes; any other decision (rejected, COMP_OFF,
    // pending) → nothing in cash.
    if (!isApprovedOt && d.otApprovalStatus !== null) continue;
    const rawOtMinutes = isApprovedOt
      ? Number(d.otMinutesApproved ?? 0)
      : Number(d.otMinutesCalculated ?? 0);
    // Threshold (qualification, not deduction) + daily cap. A null
    // maxOtHoursPerDay means no cap — one implementation, shared with
    // the attendance screens.
    const shiftEndTod = d.shiftMaster ? parseShiftTime(d.shiftMaster.endTime) : undefined;
    const dayOtMinutes = computeOtPayableMinutes(rawOtMinutes, otPlanLite, shiftEndTod);
    if (dayOtMinutes <= 0) continue;
    const dayOtHours = dayOtMinutes / 60;
    let dayFactor = baseFactor;
    let dayType: OtDayDetail['dayType'] = 'weekday';
    if (d.isHolidayWorked && otPlan?.holidayFactor) {
      dayFactor = baseFactor * Number(otPlan.holidayFactor);
    } else if (d.isWeeklyOffWorked && otPlan?.weeklyOffFactor) {
      dayFactor = baseFactor * Number(otPlan.weeklyOffFactor);
    } else if (otPlan?.weekdayFactor) {
      dayFactor = baseFactor * Number(otPlan.weekdayFactor);
    }
    // Day-type label mirrors the factor branches above, except that the
    // flags are authoritative even when the plan leaves that factor null.
    if (d.isHolidayWorked) dayType = 'holiday';
    else if (d.isWeeklyOffWorked) dayType = 'weeklyOff';

    totalOtAmount += dayOtHours * otHourlyRate * dayFactor;
    totalOtHours += dayOtHours;
    // Aggregate by week.
    const weekKey = getIsoWeekKey(d.date);
    weeklyOtHours.set(weekKey, (weeklyOtHours.get(weekKey) ?? 0) + dayOtHours);

    days.push({
      date: d.date,
      rawOtMinutes,
      payableOtMinutes: dayOtMinutes,
      payableOtHours: dayOtHours,
      dayType,
      factorApplied: dayFactor,
      amount: dayOtHours * otHourlyRate * dayFactor,
      isoWeek: weekKey,
    });
  }

  const uncappedOtHours = totalOtHours;

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

  // Apply monthly cap from OTPlan when set — scales the amount in step
  // with the hours, exactly like the weekly cap above. (The daily cap
  // is already applied per row; there is no "daily cap × calendar
  // days" monthly ceiling.)
  ({ totalOtHours, totalOtAmount } = applyMonthlyOtCap(totalOtHours, totalOtAmount, otPlan?.maxOtHoursPerMonth));

  let otAmount = totalOtAmount;
  let otIncentiveAmount = 0;
  let matchedSlab: OtIncentiveSlabLike | null = null;

  // Apply the matching OT incentive slab, if any, for this month's total
  // OT hours. A slab is either a flat monthly bonus (flatBonusAmount set
  // — added as its own earning, otAmount is untouched) or a multiplier
  // on OT pay (the original behaviour). Bands don't stack — the first
  // matching slab wins, same convention as every other slab table here.
  if (otIncentiveSlabs.length > 0 && totalOtHours > 0) {
    const slab = otIncentiveSlabs.find(
      (s) => totalOtHours >= Number(s.minOtHours) && (s.maxOtHours === null || totalOtHours < Number(s.maxOtHours))
    );
    if (slab?.flatBonusAmount != null) {
      otIncentiveAmount = round(Number(slab.flatBonusAmount));
    } else if (slab) {
      otAmount *= Number(slab.incentiveMultiplier);
    }
    matchedSlab = slab ?? null;
  }
  otAmount = round(otAmount);

  return {
    otAmount,
    otIncentiveAmount,
    totalOtHours,
    uncappedOtHours,
    otHourlyRate,
    baseFactor,
    otBasis,
    otPlan,
    matchedSlab,
    days,
  };
}
