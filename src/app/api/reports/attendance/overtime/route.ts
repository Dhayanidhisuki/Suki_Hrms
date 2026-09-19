/**
 * GET /api/reports/attendance/overtime?year=X&month=Y&format=csv&detail=1
 *
 * Attendance OT Report — source + computed data side-by-side, matching
 * with OT payroll.
 *
 * For each employee:
 *   - Monthly summary: OT hours from DailyAttendance (source) vs OT amount
 *     from PayrollLine (computed), OT plan config, OT incentive slab.
 *   - Per-day detail: each day's OT minutes, approval status, settlement
 *     type, day-type, factor, shift code — the raw source data that
 *     payroll's calculatePayrollRun reads.
 *   - Reconciliation: source OT hours vs computed OT amount, with match
 *     indicator.
 *
 * `?detail=1` returns per-day rows for all employees (flat list).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.view');
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

  // ── Fetch OT plan config ──
  const otPlans = await prisma.oTPlan.findMany({
    where: { isActive: true, deletedAt: null },
  });
  const otPlan = otPlans.find((p) => p.isActive) ?? null;

  // ── Fetch OT incentive slabs ──
  const otIncentiveSlabs = await prisma.oTIncentiveSlab.findMany({
    where: { companyId: scope.companyId, isActive: true, effectiveTo: null },
  });

  // ── Fetch employees ──
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

  // ── Fetch monthly attendance summaries ──
  const summaries = await prisma.monthlyAttendanceSummary.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      year,
      month,
    },
  });
  const summaryByEmp = new Map(summaries.map((s) => [s.employeeId, s]));

  // ── Fetch ALL daily attendance rows with OT (not just payable) ──
  const dailyOtRows = await prisma.dailyAttendance.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      date: { gte: monthStart, lt: monthEnd },
      otMinutesCalculated: { gt: 0 },
    },
    include: {
      shiftMaster: { select: { code: true, name: true, startTime: true, endTime: true } },
    },
    orderBy: { date: 'asc' },
  });

  const dailyOtByEmp = new Map<number, typeof dailyOtRows>();
  for (const d of dailyOtRows) {
    const list = dailyOtByEmp.get(d.employeeId) ?? [];
    list.push(d);
    dailyOtByEmp.set(d.employeeId, list);
  }

  // ── Fetch payroll run + lines (computed side) ──
  const run = await prisma.payrollRun.findFirst({
    where: { companyId: scope.companyId, year, month },
  });

  let payrollLineByEmp = new Map<number, { otAmount: number; otIncentiveAmount: number; lineStatus: string }>();
  if (run) {
    const lines = await prisma.payrollLine.findMany({
      where: { payrollRunId: run.id },
      select: { employeeId: true, otAmount: true, otIncentiveAmount: true, status: true },
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

    // Per-day detail — ALL OT rows (not just payable)
    let totalOtMinutesCalculated = 0;
    let totalOtMinutesApproved = 0;
    let totalPayableOtMinutes = 0;

    const dailyBreakdown = dailyRows.map((d) => {
      const isApprovedOt = d.otApprovalStatus === 'approved' && d.otSettlementType === 'OT';
      const isCompOff = d.otApprovalStatus === 'approved' && d.otSettlementType === 'COMP_OFF';
      const isPending = d.otApprovalStatus?.startsWith('pending') ?? false;
      const isRejected = d.otApprovalStatus === 'rejected';

      const rawOtMinutes = Number(d.otMinutesCalculated ?? 0);
      const approvedMin = d.otMinutesApproved ? Number(d.otMinutesApproved) : null;

      totalOtMinutesCalculated += rawOtMinutes;
      if (approvedMin) totalOtMinutesApproved += approvedMin;

      // Payable OT minutes (same logic as payroll)
      let payableOtMinutes = 0;
      let payableStatus = 'not_payable';
      if (isApprovedOt && approvedMin) {
        payableOtMinutes = approvedMin;
        payableStatus = 'payable_cash';
        totalPayableOtMinutes += approvedMin;
      } else if (d.otApprovalStatus === null && rawOtMinutes > 0) {
        // No approval workflow — pay calculated minutes
        payableOtMinutes = rawOtMinutes;
        payableStatus = 'payable_no_workflow';
        totalPayableOtMinutes += rawOtMinutes;
      } else if (isCompOff) {
        payableStatus = 'comp_off';
      } else if (isPending) {
        payableStatus = 'pending';
      } else if (isRejected) {
        payableStatus = 'rejected';
      }

      // Day type
      let dayType = 'weekday';
      if (d.isHolidayWorked) dayType = 'holiday';
      else if (d.isWeeklyOffWorked) dayType = 'weeklyOff';

      // Factor
      let factor = otPlan ? Number(otPlan.otRateMultiplier) : Number(jobInfo?.overtimeFactor ?? 1);
      if (d.isHolidayWorked && otPlan?.holidayFactor) {
        factor = factor * Number(otPlan.holidayFactor);
      } else if (d.isWeeklyOffWorked && otPlan?.weeklyOffFactor) {
        factor = factor * Number(otPlan.weeklyOffFactor);
      } else if (otPlan?.weekdayFactor) {
        factor = factor * Number(otPlan.weekdayFactor);
      }

      return {
        id: d.id,
        date: d.date.toISOString().slice(0, 10),
        dayOfWeek: d.date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
        shiftCode: d.shiftMaster?.code ?? '—',
        shiftName: d.shiftMaster?.name ?? '—',
        status: d.status,
        inTime: d.inTime ? d.inTime.toISOString().slice(11, 19) : '—',
        outTime: d.outTime ? d.outTime.toISOString().slice(11, 19) : '—',
        otMinutesCalculated: rawOtMinutes,
        otMinutesApproved: approvedMin,
        otApprovalStatus: d.otApprovalStatus ?? '—',
        otSettlementType: d.otSettlementType ?? '—',
        dayType,
        factorApplied: factor,
        payableOtMinutes,
        payableStatus,
        isHolidayWorked: d.isHolidayWorked,
        isWeeklyOffWorked: d.isWeeklyOffWorked,
      };
    });

    // Match OT incentive slab
    const matchedSlab = otIncentiveSlabs.find(
      (s) => otHoursSource >= Number(s.minOtHours) && (s.maxOtHours === null || otHoursSource < Number(s.maxOtHours))
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
      attendanceStatus: summary?.status ?? '—',
      payableDays: summary ? Number(summary.payableDays) : 0,
      lopDays: summary ? Number(summary.lopDays) : 0,
      // Source: per-day aggregation
      totalOtMinutesCalculated,
      totalOtMinutesApproved,
      totalPayableOtMinutes,
      totalPayableOtHours: Number((totalPayableOtMinutes / 60).toFixed(2)),
      totalOtDays: dailyRows.length,
      approvedCashDays: dailyRows.filter((d) => d.otApprovalStatus === 'approved' && d.otSettlementType === 'OT').length,
      compOffDays: dailyRows.filter((d) => d.otApprovalStatus === 'approved' && d.otSettlementType === 'COMP_OFF').length,
      pendingDays: dailyRows.filter((d) => d.otApprovalStatus?.startsWith('pending') ?? false).length,
      rejectedDays: dailyRows.filter((d) => d.otApprovalStatus === 'rejected').length,
      noWorkflowDays: dailyRows.filter((d) => d.otApprovalStatus === null && Number(d.otMinutesCalculated) > 0).length,
      // Computed: payroll
      otAmountComputed: payrollLine?.otAmount ?? 0,
      otIncentiveAmountComputed: payrollLine?.otIncentiveAmount ?? 0,
      lineStatus: payrollLine?.lineStatus ?? '—',
      // Config
      otPlanCode: otPlan?.code ?? '—',
      otBasis: otPlan?.otCalculationBasis ?? 'GROSS',
      otRateMultiplier: otPlan ? Number(otPlan.otRateMultiplier) : Number(jobInfo?.overtimeFactor ?? 1),
      applicableAfterMinutes: otPlan?.applicableAfterMinutes ?? 0,
      maxOtHoursPerDay: otPlan?.maxOtHoursPerDay ?? null,
      maxOtHoursPerWeek: otPlan?.maxOtHoursPerWeek ?? null,
      maxOtHoursPerMonth: otPlan?.maxOtHoursPerMonth ?? null,
      // Slab
      matchedSlabCode: matchedSlab?.code ?? null,
      matchedSlabType: matchedSlab?.flatBonusAmount != null ? 'FLAT_BONUS' : (matchedSlab ? 'MULTIPLIER' : null),
      matchedSlabFlatBonus: matchedSlab?.flatBonusAmount != null ? Number(matchedSlab.flatBonusAmount) : null,
      matchedSlabMultiplier: matchedSlab ? Number(matchedSlab.incentiveMultiplier) : null,
      // Per-day detail
      dailyBreakdown,
    };
  });

  // ── Totals ──
  const totals = rows.reduce(
    (acc, r) => {
      acc.otHoursSource += r.otHoursSource;
      acc.totalPayableOtHours += r.totalPayableOtHours;
      acc.otAmountComputed += r.otAmountComputed;
      acc.otIncentiveAmountComputed += r.otIncentiveAmountComputed;
      acc.employeesWithOt += r.totalOtDays > 0 ? 1 : 0;
      acc.approvedCashDays += r.approvedCashDays;
      acc.compOffDays += r.compOffDays;
      acc.pendingDays += r.pendingDays;
      acc.rejectedDays += r.rejectedDays;
      acc.noWorkflowDays += r.noWorkflowDays;
      return acc;
    },
    {
      otHoursSource: 0, totalPayableOtHours: 0, otAmountComputed: 0,
      otIncentiveAmountComputed: 0, employeesWithOt: 0,
      approvedCashDays: 0, compOffDays: 0, pendingDays: 0, rejectedDays: 0, noWorkflowDays: 0,
    }
  );

  // ── CSV export ──
  if (format === 'csv') {
    if (detail) {
      const headers = [
        'Employee Code', 'Employee Name', 'Department', 'Date', 'Day',
        'Shift Code', 'Attendance Status', 'In Time', 'Out Time',
        'OT Calc Min', 'OT Approved Min', 'Approval Status', 'Settlement Type',
        'Day Type', 'Factor', 'Payable OT Min', 'Payable Status',
      ];
      const csvRows: string[] = [];
      for (const r of rows) {
        for (const d of r.dailyBreakdown) {
          csvRows.push([
            r.employeeCode, r.employeeName, r.department, d.date, d.dayOfWeek,
            d.shiftCode, d.status, d.inTime, d.outTime,
            d.otMinutesCalculated, d.otMinutesApproved ?? '', d.otApprovalStatus, d.otSettlementType,
            d.dayType, d.factorApplied.toFixed(2), d.payableOtMinutes, d.payableStatus,
          ].map((v) => `"${v}"`).join(','));
        }
      }
      const csv = [headers.join(','), ...csvRows].join('\n');
      return new NextResponse(csv, {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="attendance_ot_detail_${year}_${month}.csv"` },
      });
    }

    const headers = [
      'Employee Code', 'Employee Name', 'Department', 'OT Allowed',
      'OT Hours (Summary)', 'Payable OT Hours (Per-Day)', 'OT Days',
      'Approved Cash', 'Comp-Off', 'Pending', 'Rejected', 'No Workflow',
      'OT Amount (Payroll)', 'OT Incentive (Payroll)',
      'OT Plan', 'OT Basis', 'Rate Multiplier',
      'Slab Code', 'Slab Type', 'Flat Bonus', 'Multiplier',
      'Attendance Status', 'Line Status',
    ];
    const csvRows = rows.map((r) => [
      r.employeeCode, r.employeeName, r.department, r.overtimeAllowed ? 'Yes' : 'No',
      r.otHoursSource.toFixed(2), r.totalPayableOtHours.toFixed(2), r.totalOtDays,
      r.approvedCashDays, r.compOffDays, r.pendingDays, r.rejectedDays, r.noWorkflowDays,
      r.otAmountComputed.toFixed(2), r.otIncentiveAmountComputed.toFixed(2),
      r.otPlanCode, r.otBasis, r.otRateMultiplier.toFixed(2),
      r.matchedSlabCode ?? '—', r.matchedSlabType ?? '—', r.matchedSlabFlatBonus ?? '', r.matchedSlabMultiplier ?? '',
      r.attendanceStatus, r.lineStatus,
    ]);
    const csv = [headers.join(','), ...csvRows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="attendance_ot_summary_${year}_${month}.csv"` },
    });
  }

  // ── JSON ──
  if (detail) {
    const flatDaily: Array<Record<string, unknown>> = [];
    for (const r of rows) {
      for (const d of r.dailyBreakdown) {
        flatDaily.push({
          employeeCode: r.employeeCode, employeeName: r.employeeName, department: r.department,
          ...d,
        });
      }
    }
    return NextResponse.json({
      run: run ? { id: run.id, status: run.status } : null,
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
    run: run ? { id: run.id, status: run.status } : null,
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
