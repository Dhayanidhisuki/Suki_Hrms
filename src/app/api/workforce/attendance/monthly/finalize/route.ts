/**
 * POST /api/workforce/attendance/monthly/finalize
 * Body: { year, month, employeeId? }
 *
 * Computes MonthlyAttendanceSummary from that month's DailyAttendance rows
 * (present/absent/leave/LOP day counts, OT/late/early-out minute totals) and
 * upserts it with status FINALIZED — the "Time Office Final" step, done for
 * one employee if employeeId is given, otherwise every active employee in
 * the company for that month.
 *
 * Auto-generates DailyAttendance rows for missing days:
 * - Sundays → WeeklyOff
 * - Declared holidays → Holiday
 * - All other missing days → Absent
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { isWeeklyOffForEmployee } from '@/lib/weeklyOff';

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const month = Number(body?.month);
  const employeeIdFilter = body?.employeeId ? Number(body.employeeId) : undefined;

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year and month (1-12) are required' }, { status: 400 });
  }

  // Guard: do not re-finalize a frozen month
  if (employeeIdFilter) {
    const freezeErr = await checkMonthNotFrozen(employeeIdFilter, new Date(Date.UTC(year, month - 1, 1)));
    if (freezeErr) return freezeErr;
  } else {
    const frozenCount = await prisma.monthlyAttendanceSummary.count({
      where: {
        year, month, status: 'FROZEN',
        employee: { companyId: scope.companyId, deletedAt: null },
      },
    });
    if (frozenCount > 0) {
      return NextResponse.json(
        { error: `${frozenCount} employee(s) have FROZEN attendance for ${year}-${month}. Reopen before re-finalizing.` },
        { status: 409 }
      );
    }
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const holidays = await prisma.holidayMaster.findMany({
    where: { companyId: scope.companyId, isActive: true, deletedAt: null, date: { gte: monthStart, lt: monthEnd } },
    select: { date: true },
  });
  const holidayDates = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));

  const employees = await prisma.employee.findMany({
    where: {
      companyId: scope.companyId,
      deletedAt: null,
      isActive: true,
      ...(employeeIdFilter ? { id: employeeIdFilter } : {}),
    },
    select: {
      id: true,
      jobInfos: { where: { effectiveTo: null }, take: 1, select: { joinDate: true } },
      exitInterview: { select: { exitDate: true } },
      dailyAttendances: { where: { date: { gte: monthStart, lt: monthEnd } } },
    },
  });

  if (employeeIdFilter && employees.length === 0) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const userId = Number(request.headers.get('x-user-id'));
  const now = new Date();
  const totalCalendarDays = daysInMonth(year, month);

  // Auto-generate attendance rows for missing days via the history helper
  // so every insert has a proper audit trail.
  for (const emp of employees) {
    const existingDates = new Set(emp.dailyAttendances.map((d) => d.date.toISOString().slice(0, 10)));
    const joinDate = emp.jobInfos[0]?.joinDate ? new Date(emp.jobInfos[0].joinDate) : null;
    const exitDate = emp.exitInterview?.exitDate ? new Date(emp.exitInterview.exitDate) : null;

    for (let day = 1; day <= totalCalendarDays; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const date = new Date(Date.UTC(year, month - 1, day));

      // Skip dates before joining or after exit (not employed)
      if (joinDate && date < joinDate) continue;
      if (exitDate && date > exitDate) continue;

      // Skip dates that already have attendance records
      if (existingDates.has(dateStr)) continue;

      // Determine the correct status for the missing day
      const isWeeklyOff = await isWeeklyOffForEmployee(emp.id, date);
      let status: string;
      if (isWeeklyOff) {
        status = 'WeeklyOff';
      } else if (holidayDates.has(dateStr)) {
        status = 'Holiday';
      } else {
        status = 'Absent';
      }

      await upsertDailyAttendanceWithHistory(
        prisma,
        emp.id,
        date,
        { status, source: 'SYSTEM_AUTO' },
        { userId: userId || null, changedBySource: 'system_finalize' }
      );
    }
  }

  // Re-fetch employees with updated daily attendances
  const updatedEmployees = await prisma.employee.findMany({
    where: {
      companyId: scope.companyId,
      deletedAt: null,
      isActive: true,
      ...(employeeIdFilter ? { id: employeeIdFilter } : {}),
    },
    select: {
      id: true,
      dailyAttendances: { where: { date: { gte: monthStart, lt: monthEnd } } },
    },
  });

  const results = await Promise.all(
    updatedEmployees.map(async (e) => {
      const days = e.dailyAttendances;
      let presentDays = 0;
      let absentDays = 0;
      let leaveDays = 0;
      let lopDays = 0;
      let halfDays = 0;
      let weeklyOffDays = 0;
      let holidayDays = 0;
      let otMinutesApprovedTotal = 0;
      let lateMinutesTotal = 0;
      let earlyOutMinutesTotal = 0;

      for (const d of days) {
        if (d.status === 'Present' || d.status === 'OnDuty') {
          presentDays += 1;
        } else if (d.status === 'HalfDay') {
          presentDays += 0.5;
          halfDays += 1;
        } else if (d.status === 'Absent' || d.status === 'MissingPunch') {
          absentDays += 1;
        } else if (d.status === 'Leave') {
          leaveDays += 1;
        } else if (d.status === 'LOP') {
          lopDays += 1;
        } else if (d.status === 'WeeklyOff') {
          weeklyOffDays += 1;
        } else if (d.status === 'Holiday') {
          holidayDays += 1;
        }

        // Only HR-approved OT with settlementType === 'OT' is paid out in payroll
        if (d.otApprovalStatus === 'approved' && d.otSettlementType === 'OT' && d.otMinutesApproved) {
          otMinutesApprovedTotal += d.otMinutesApproved;
        }
        lateMinutesTotal += d.lateMinutes;
        earlyOutMinutesTotal += d.earlyOutMinutes;
      }

      const totalAbsentDays = absentDays + halfDays * 0.5;
      const payableDays = Math.max(0, totalCalendarDays - totalAbsentDays - lopDays);

      return prisma.monthlyAttendanceSummary.upsert({
        where: { employeeId_year_month: { employeeId: e.id, year, month } },
        update: {
          totalWorkingDays: totalCalendarDays,
          payableDays,
          presentDays,
          absentDays: totalAbsentDays,
          leaveDays,
          lopDays,
          otMinutesTotal: otMinutesApprovedTotal,
          lateMinutesTotal,
          earlyOutMinutesTotal,
          status: 'FINALIZED',
          finalizedAt: now,
          finalizedByUserId: userId,
        },
        create: {
          employeeId: e.id,
          year,
          month,
          totalWorkingDays: totalCalendarDays,
          payableDays,
          presentDays,
          absentDays: totalAbsentDays,
          leaveDays,
          lopDays,
          otMinutesTotal: otMinutesApprovedTotal,
          lateMinutesTotal,
          earlyOutMinutesTotal,
          status: 'FINALIZED',
          finalizedAt: now,
          finalizedByUserId: userId,
        },
      });
    })
  );

  return NextResponse.json({ message: `Finalized ${results.length} employee(s)`, data: results });
}
