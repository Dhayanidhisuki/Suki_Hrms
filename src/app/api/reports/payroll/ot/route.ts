/**
 * GET /api/reports/payroll/ot?year=X&month=Y&format=csv
 *
 * Complete OT Report — source + computed data side-by-side.
 *
 * For each employee in the payroll run:
 *   - Monthly summary: OT hours from MonthlyAttendanceSummary (source),
 *     OT amount + OT incentive from PayrollLine (computed),
 *     OT plan config used (OTPlan), OT incentive slab matched.
 *   - Per-day detail (in `dailyBreakdown`): each DailyAttendance row with
 *     OT minutes calculated/approved, approval status, settlement type,
 *     day-type (weekday/weeklyOff/holiday), shift code, and the factor
 *     that was applied.
 *
 * The `?detail=1` query param returns per-day rows for all employees
 * (flat list) instead of nested under each employee.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? '0');
  const month = parseInt(searchParams.get('month') ?? '0');
  const format = searchParams.get('format');
  const detail = searchParams.get('detail') === '1';

  if (!year || !month) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  // ── Fetch the payroll run (computed side) ──
  const run = await prisma.payrollRun.findFirst({
    where: { companyId: scope.companyId, year, month },
  });

  // ── Fetch OT plan config (source side) ──
  const otPlans = await prisma.oTPlan.findMany({
    where: { isActive: true, deletedAt: null },
  });
  const otPlan = otPlans.find((p) => p.isActive) ?? null;

  // ── Fetch OT incentive slabs (source side) ──
  const otIncentiveSlabs = await prisma.oTIncentiveSlab.findMany({
    where: { companyId: scope.companyId, isActive: true, effectiveTo: null },
  });

  // ── Fetch all active employees with OT eligibility ──
  const employees = await prisma.employee.findMany({
    where: { companyId: scope.companyId, deletedAt: null, isActive: true },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: {
          overtimeAllowed: true,
          overtimeFactor: true,
          overtimeRatePerHour: true,
          department: { select: { name: true } },
          designation: { select: { name: true } },
        },
      },
    },
    orderBy: { employeeCode: 'asc' },
  });

  // ── Fetch monthly attendance summaries (source: OT minutes total) ──
  const summaries = await prisma.monthlyAttendanceSummary.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      year,
      month,
    },
    select: {
      employeeId: true,
      otMinutesTotal: true,
      lateMinutesTotal: true,
      earlyOutMinutesTotal: true,
      payableDays: true,
      lopDays: true,
      status: true,
    },
  });
  const summaryByEmp = new Map(summaries.map((s) => [s.employeeId, s]));

  // ── Fetch per-day attendance rows with OT (source: per-day detail) ──
  const dailyOtRows = await prisma.dailyAttendance.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      date: { gte: monthStart, lt: monthEnd },
      OR: [
        { otMinutesApproved: { gt: 0 }, otApprovalStatus: 'approved', otSettlementType: 'OT' },
        { otApprovalStatus: null, otMinutesCalculated: { gt: 0 } },
      ],
    },
    include: {
      shiftMaster: { select: { code: true, name: true, startTime: true, endTime: true } },
    },
    orderBy: { date: 'asc' },
  });

  // Group daily OT rows by employee
  const dailyOtByEmp = new Map<number, typeof dailyOtRows>();
  for (const d of dailyOtRows) {
    const list = dailyOtByEmp.get(d.employeeId) ?? [];
    list.push(d);
    dailyOtByEmp.set(d.employeeId, list);
  }

  // ── Fetch payroll lines (computed: OT amount, OT incentive) ──
  let payrollLineByEmp = new Map<number, { otAmount: number; otIncentiveAmount: number; lineStatus: string }>();
  if (run) {
    const lines = await prisma.payrollLine.findMany({
      where: { payrollRunId: run.id },
      select: {
        employeeId: true,
        otAmount: true,
        otIncentiveAmount: true,
        status: true,
      },
    });
    payrollLineByEmp = new Map(lines.map((l) => [
      l.employeeId,
      { otAmount: Number(l.otAmount), otIncentiveAmount: Number(l.otIncentiveAmount), lineStatus: l.status },
    ]));
  }

  // ── Build per-employee rows ──
  const rows = employees.map((emp) => {
    const jobInfo = emp.jobInfos[0];
    const summary = summaryByEmp.get(emp.id);
    const dailyRows = dailyOtByEmp.get(emp.id) ?? [];
    const payrollLine = payrollLineByEmp.get(emp.id);

    const otMinutesTotal = Number(summary?.otMinutesTotal ?? 0);
    const otHoursSource = otMinutesTotal / 60;

    // Compute total payable OT minutes from per-day rows (source verification)
    let totalOtMinutesFromDays = 0;
    const dailyBreakdown = dailyRows.map((d) => {
      const isApprovedOt = d.otApprovalStatus === 'approved' && d.otSettlementType === 'OT';
      const rawOtMinutes = isApprovedOt
        ? Number(d.otMinutesApproved ?? 0)
        : Number(d.otMinutesCalculated ?? 0);

      // Determine day type
      let dayType = 'weekday';
      if (d.isHolidayWorked) dayType = 'holiday';
      else if (d.isWeeklyOffWorked) dayType = 'weeklyOff';

      // Determine factor applied
      let factor = otPlan ? Number(otPlan.otRateMultiplier) : Number(jobInfo?.overtimeFactor ?? 1);
      if (d.isHolidayWorked && otPlan?.holidayFactor) {
        factor = factor * Number(otPlan.holidayFactor);
      } else if (d.isWeeklyOffWorked && otPlan?.weeklyOffFactor) {
        factor = factor * Number(otPlan.weeklyOffFactor);
      } else if (otPlan?.weekdayFactor) {
        factor = factor * Number(otPlan.weekdayFactor);
      }

      totalOtMinutesFromDays += rawOtMinutes;

      return {
        date: d.date.toISOString().slice(0, 10),
        shiftCode: d.shiftMaster?.code ?? '—',
        shiftName: d.shiftMaster?.name ?? '—',
        status: d.status,
        otMinutesCalculated: Number(d.otMinutesCalculated ?? 0),
        otMinutesApproved: d.otMinutesApproved ? Number(d.otMinutesApproved) : null,
        otApprovalStatus: d.otApprovalStatus ?? '—',
        otSettlementType: d.otSettlementType ?? '—',
        dayType,
        factorApplied: factor,
        payableOtMinutes: rawOtMinutes,
        payableOtHours: Number((rawOtMinutes / 60).toFixed(2)),
      };
    });

    // Find matching OT incentive slab
    const otHours = otHoursSource;
    const matchedSlab = otIncentiveSlabs.find(
      (s) => otHours >= Number(s.minOtHours) && (s.maxOtHours === null || otHours < Number(s.maxOtHours))
    ) ?? null;

    return {
      id: emp.id,
      employeeCode: emp.employeeCode,
      employeeName: `${emp.firstName} ${emp.lastName ?? ''}`.trim(),
      department: jobInfo?.department?.name ?? '—',
      designation: jobInfo?.designation?.name ?? '—',
      overtimeAllowed: jobInfo?.overtimeAllowed ?? false,
      // Source: attendance summary
      otMinutesTotalSource: otMinutesTotal,
      otHoursSource: Number(otHoursSource.toFixed(2)),
      otMinutesFromDaysSource: totalOtMinutesFromDays,
      otHoursFromDaysSource: Number((totalOtMinutesFromDays / 60).toFixed(2)),
      attendanceStatus: summary?.status ?? '—',
      payableDays: summary ? Number(summary.payableDays) : 0,
      lopDays: summary ? Number(summary.lopDays) : 0,
      // Computed: payroll line
      otAmountComputed: payrollLine?.otAmount ?? 0,
      otIncentiveAmountComputed: payrollLine?.otIncentiveAmount ?? 0,
      lineStatus: payrollLine?.lineStatus ?? '—',
      // Config used
      otPlanCode: otPlan?.code ?? '—',
      otPlanName: otPlan?.name ?? '—',
      otBasis: otPlan?.otCalculationBasis ?? 'GROSS',
      otRateMultiplier: otPlan ? Number(otPlan.otRateMultiplier) : Number(jobInfo?.overtimeFactor ?? 1),
      applicableAfterMinutes: otPlan?.applicableAfterMinutes ?? 0,
      maxOtHoursPerDay: otPlan?.maxOtHoursPerDay ?? null,
      maxOtHoursPerWeek: otPlan?.maxOtHoursPerWeek ?? null,
      maxOtHoursPerMonth: otPlan?.maxOtHoursPerMonth ?? null,
      // OT incentive slab
      matchedSlabCode: matchedSlab?.code ?? null,
      matchedSlabName: matchedSlab?.name ?? null,
      matchedSlabType: matchedSlab?.flatBonusAmount != null ? 'FLAT_BONUS' : (matchedSlab ? 'MULTIPLIER' : null),
      matchedSlabFlatBonus: matchedSlab?.flatBonusAmount != null ? Number(matchedSlab.flatBonusAmount) : null,
      matchedSlabMultiplier: matchedSlab ? Number(matchedSlab.incentiveMultiplier) : null,
      // Per-day detail
      dailyBreakdown,
      dailyOtDays: dailyRows.length,
    };
  });

  // ── Totals ──
  const totals = rows.reduce(
    (acc, r) => {
      acc.otHoursSource += r.otHoursSource;
      acc.otHoursFromDaysSource += r.otHoursFromDaysSource;
      acc.otAmountComputed += r.otAmountComputed;
      acc.otIncentiveAmountComputed += r.otIncentiveAmountComputed;
      acc.employeesWithOt += r.otHoursSource > 0 ? 1 : 0;
      return acc;
    },
    { otHoursSource: 0, otHoursFromDaysSource: 0, otAmountComputed: 0, otIncentiveAmountComputed: 0, employeesWithOt: 0 }
  );

  // ── CSV export ──
  if (format === 'csv') {
    if (detail) {
      // Per-day detail CSV
      const headers = [
        'Employee Code', 'Employee Name', 'Department', 'Date', 'Shift Code',
        'Attendance Status', 'OT Minutes Calculated', 'OT Minutes Approved',
        'Approval Status', 'Settlement Type', 'Day Type', 'Factor Applied',
        'Payable OT Minutes', 'Payable OT Hours',
      ];
      const csvRows: string[] = [];
      for (const r of rows) {
        for (const d of r.dailyBreakdown) {
          csvRows.push([
            r.employeeCode, r.employeeName, r.department, d.date, d.shiftCode,
            d.status, d.otMinutesCalculated, d.otMinutesApproved ?? '',
            d.otApprovalStatus, d.otSettlementType, d.dayType, d.factorApplied.toFixed(2),
            d.payableOtMinutes, d.payableOtHours.toFixed(2),
          ].map((v) => `"${v}"`).join(','));
        }
      }
      const csv = [headers.join(','), ...csvRows].join('\n');
      return new NextResponse(csv, {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="ot_detail_${year}_${month}.csv"` },
      });
    }

    // Monthly summary CSV
    const headers = [
      'Employee Code', 'Employee Name', 'Department', 'Designation', 'OT Allowed',
      'OT Hours (Summary)', 'OT Hours (Per-Day Sum)', 'OT Amount (Payroll)',
      'OT Incentive (Payroll)', 'OT Plan', 'OT Basis', 'Rate Multiplier',
      'Matched Slab', 'Slab Type', 'Flat Bonus', 'Multiplier',
      'Attendance Status', 'Payable Days', 'LOP Days', 'Line Status',
    ];
    const csvRows = rows.map((r) => [
      r.employeeCode, r.employeeName, r.department, r.designation, r.overtimeAllowed ? 'Yes' : 'No',
      r.otHoursSource.toFixed(2), r.otHoursFromDaysSource.toFixed(2), r.otAmountComputed.toFixed(2),
      r.otIncentiveAmountComputed.toFixed(2), r.otPlanCode, r.otBasis, r.otRateMultiplier.toFixed(2),
      r.matchedSlabCode ?? '—', r.matchedSlabType ?? '—', r.matchedSlabFlatBonus ?? '', r.matchedSlabMultiplier ?? '',
      r.attendanceStatus, r.payableDays, r.lopDays, r.lineStatus,
    ]);
    const csv = [headers.join(','), ...csvRows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="ot_summary_${year}_${month}.csv"` },
    });
  }

  // ── JSON response ──
  if (detail) {
    // Flat per-day list
    const flatDaily: Array<{
      employeeCode: string;
      employeeName: string;
      department: string;
      date: string;
      shiftCode: string;
      shiftName: string;
      status: string;
      otMinutesCalculated: number;
      otMinutesApproved: number | null;
      otApprovalStatus: string;
      otSettlementType: string;
      dayType: string;
      factorApplied: number;
      payableOtMinutes: number;
      payableOtHours: number;
    }> = [];
    for (const r of rows) {
      for (const d of r.dailyBreakdown) {
        flatDaily.push({
          employeeCode: r.employeeCode,
          employeeName: r.employeeName,
          department: r.department,
          date: d.date,
          shiftCode: d.shiftCode,
          shiftName: d.shiftName,
          status: d.status,
          otMinutesCalculated: d.otMinutesCalculated,
          otMinutesApproved: d.otMinutesApproved,
          otApprovalStatus: d.otApprovalStatus,
          otSettlementType: d.otSettlementType,
          dayType: d.dayType,
          factorApplied: d.factorApplied,
          payableOtMinutes: d.payableOtMinutes,
          payableOtHours: d.payableOtHours,
        });
      }
    }
    return NextResponse.json({
      run: run ? { id: run.id, year: run.year, month: run.month, status: run.status } : null,
      otPlan: otPlan ? {
        code: otPlan.code, name: otPlan.name, otBasis: otPlan.otCalculationBasis,
        rateMultiplier: Number(otPlan.otRateMultiplier),
        applicableAfterMinutes: otPlan.applicableAfterMinutes,
        maxOtHoursPerDay: otPlan.maxOtHoursPerDay,
        maxOtHoursPerWeek: otPlan.maxOtHoursPerWeek,
        maxOtHoursPerMonth: otPlan.maxOtHoursPerMonth,
      } : null,
      rows: flatDaily,
      totals,
    });
  }

  return NextResponse.json({
    run: run ? { id: run.id, year: run.year, month: run.month, status: run.status } : null,
    otPlan: otPlan ? {
      code: otPlan.code, name: otPlan.name, otBasis: otPlan.otCalculationBasis,
      rateMultiplier: Number(otPlan.otRateMultiplier),
      applicableAfterMinutes: otPlan.applicableAfterMinutes,
      maxOtHoursPerDay: otPlan.maxOtHoursPerDay,
      maxOtHoursPerWeek: otPlan.maxOtHoursPerWeek,
      maxOtHoursPerMonth: otPlan.maxOtHoursPerMonth,
    } : null,
    rows,
    totals,
  });
}
