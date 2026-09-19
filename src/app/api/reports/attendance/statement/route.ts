/**
 * GET /api/reports/attendance/statement?year=X&month=Y&employeeId=Z&format=csv
 *
 * Attendance Statement Report — per-employee daily attendance detail for
 * a selected month. One row per employee per day showing date, shift,
 * in/out times, working minutes, late minutes, early-out minutes, OT
 * minutes (calculated + approved), approval status, settlement type,
 * LOM minutes/status, day-type flags (holiday/weekly-off worked), and
 * attendance status.
 *
 * Optional ?employeeId=Z filters to a single employee.
 * The monthly summary (MonthlyAttendanceSummary) is included as a header
 * for each employee — payable days, LOP, OT total, late total, etc.
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
  const employeeIdParam = searchParams.get('employeeId');

  if (!year || !month) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  // ── Fetch employees ──
  const employeeFilter: Record<string, unknown> = {
    companyId: scope.companyId,
    deletedAt: null,
    isActive: true,
  };
  if (employeeIdParam) {
    employeeFilter.id = parseInt(employeeIdParam);
  }

  const employees = await prisma.employee.findMany({
    where: employeeFilter,
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: {
          department: { select: { name: true } },
          designation: { select: { name: true } },
        },
      },
    },
    orderBy: { employeeCode: 'asc' },
  });

  // ── Fetch daily attendance for the month ──
  const dailyRecords = await prisma.dailyAttendance.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      date: { gte: monthStart, lt: monthEnd },
    },
    include: {
      shiftMaster: { select: { code: true, name: true, startTime: true, endTime: true } },
    },
    orderBy: { date: 'asc' },
  });

  // Group by employee
  const dailyByEmp = new Map<number, typeof dailyRecords>();
  for (const d of dailyRecords) {
    const list = dailyByEmp.get(d.employeeId) ?? [];
    list.push(d);
    dailyByEmp.set(d.employeeId, list);
  }

  // ── Fetch monthly attendance summaries ──
  const summaries = await prisma.monthlyAttendanceSummary.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      year,
      month,
    },
  });
  const summaryByEmp = new Map(summaries.map((s) => [s.employeeId, s]));

  // ── Build per-employee rows ──
  const rows = employees.map((emp) => {
    const jobInfo = emp.jobInfos[0];
    const summary = summaryByEmp.get(emp.id);
    const daily = dailyByEmp.get(emp.id) ?? [];

    const dailyBreakdown = daily.map((d) => ({
      id: d.id,
      date: d.date.toISOString().slice(0, 10),
      dayOfWeek: d.date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      shiftCode: d.shiftMaster?.code ?? '—',
      shiftName: d.shiftMaster?.name ?? '—',
      shiftTime: d.shiftMaster ? `${d.shiftMaster.startTime}-${d.shiftMaster.endTime}` : '—',
      status: d.status,
      inTime: d.inTime ? d.inTime.toISOString().slice(11, 19) : '—',
      outTime: d.outTime ? d.outTime.toISOString().slice(11, 19) : '—',
      workingMinutes: d.workingMinutes,
      workingHours: Number((d.workingMinutes / 60).toFixed(2)),
      lateMinutes: d.lateMinutes,
      earlyOutMinutes: d.earlyOutMinutes,
      otMinutesCalculated: d.otMinutesCalculated,
      otMinutesApproved: d.otMinutesApproved ? Number(d.otMinutesApproved) : null,
      otApprovalStatus: d.otApprovalStatus ?? '—',
      otSettlementType: d.otSettlementType ?? '—',
      lomApprovalStatus: d.lomApprovalStatus ?? '—',
      lomApprovedMinutes: d.lomApprovedMinutes ? Number(d.lomApprovedMinutes) : null,
      isHolidayWorked: d.isHolidayWorked,
      isWeeklyOffWorked: d.isWeeklyOffWorked,
      source: d.source,
      remarks: d.remarks,
    }));

    return {
      id: emp.id,
      employeeCode: emp.employeeCode,
      employeeName: `${emp.firstName} ${emp.lastName ?? ''}`.trim(),
      department: jobInfo?.department?.name ?? '—',
      designation: jobInfo?.designation?.name ?? '—',
      // Monthly summary
      summary: summary ? {
        totalWorkingDays: summary.totalWorkingDays,
        payableDays: Number(summary.payableDays),
        presentDays: Number(summary.presentDays),
        absentDays: Number(summary.absentDays),
        leaveDays: Number(summary.leaveDays),
        lopDays: Number(summary.lopDays),
        otMinutesTotal: summary.otMinutesTotal,
        lateMinutesTotal: summary.lateMinutesTotal,
        earlyOutMinutesTotal: summary.earlyOutMinutesTotal,
        holidayWorkedDays: summary.holidayWorkedDays,
        permissionHours: Number(summary.permissionHours),
        permissionExcessHours: Number(summary.permissionExcessHours),
        elDays: Number(summary.elDays),
        clDays: Number(summary.clDays),
        slDays: Number(summary.slDays),
        mlDays: Number(summary.mlDays),
        plDays: Number(summary.plDays),
        compOffDays: Number(summary.compOffDays),
        otherLeaveDays: Number(summary.otherLeaveDays),
        status: summary.status,
      } : null,
      // Daily detail
      dailyBreakdown,
      totalDays: daily.length,
      presentDays: daily.filter((d) => d.status === 'Present').length,
      absentDays: daily.filter((d) => d.status === 'Absent').length,
      halfDays: daily.filter((d) => d.status === 'HalfDay').length,
      weeklyOffDays: daily.filter((d) => d.status === 'WeeklyOff').length,
      holidayDays: daily.filter((d) => d.status === 'Holiday').length,
      leaveDays: daily.filter((d) => d.status === 'Leave').length,
      onDutyDays: daily.filter((d) => d.status === 'OnDuty').length,
      lopDays: daily.filter((d) => d.status === 'LOP').length,
      missingPunchDays: daily.filter((d) => d.status === 'MissingPunch').length,
      permissionDays: daily.filter((d) => d.status === 'Permission').length,
    };
  });

  // ── CSV export ──
  if (format === 'csv') {
    const headers = [
      'Employee Code', 'Employee Name', 'Department', 'Date', 'Day',
      'Shift Code', 'Shift Time', 'Status',
      'In Time', 'Out Time', 'Working Hours',
      'Late Min', 'Early Out Min',
      'OT Calc Min', 'OT Approved Min', 'OT Approval', 'OT Settlement',
      'LOM Status', 'LOM Approved Min',
      'Holiday Worked', 'Weekly Off Worked',
      'Source', 'Remarks',
    ];
    const csvRows: string[] = [];
    for (const r of rows) {
      for (const d of r.dailyBreakdown) {
        csvRows.push([
          r.employeeCode, r.employeeName, r.department, d.date, d.dayOfWeek,
          d.shiftCode, d.shiftTime, d.status,
          d.inTime, d.outTime, d.workingHours.toFixed(2),
          d.lateMinutes, d.earlyOutMinutes,
          d.otMinutesCalculated, d.otMinutesApproved ?? '', d.otApprovalStatus, d.otSettlementType,
          d.lomApprovalStatus, d.lomApprovedMinutes ?? '',
          d.isHolidayWorked ? 'Yes' : 'No', d.isWeeklyOffWorked ? 'Yes' : 'No',
          d.source, d.remarks ?? '',
        ].map((v) => `"${v}"`).join(','));
      }
    }
    const csv = [headers.join(','), ...csvRows].join('\n');
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="attendance_statement_${year}_${month}.csv"` },
    });
  }

  return NextResponse.json({
    period: { year, month },
    employees: rows.length,
    rows,
  });
}
