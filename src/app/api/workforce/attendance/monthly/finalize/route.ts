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
 * - All other missing days → LOP
 *
 * Also reclassifies existing Absent / MissingPunch days with no in/out
 * punches to LOP, and uses refreshMonthlySummary to roll up the counts
 * including the approved-leave type breakdown (CL, SL, EL, etc.).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { buildWeeklyOffResolver } from '@/lib/weeklyOff';
import { refreshMonthlySummary } from '@/lib/biometricConversion';

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

  // Phase 1 — reclassify any existing no-punch days to LOP.
  // A day with status 'Absent' or 'MissingPunch' and no inTime/outTime
  // is treated as Loss-of-Pay per the BRD: no check-in/check-out = LOP.
  for (const emp of employees) {
    for (const d of emp.dailyAttendances) {
      const noPunch = !d.inTime && !d.outTime;
      const lopStatus = d.status === 'Absent' || d.status === 'MissingPunch';
      if (lopStatus && noPunch) {
        await upsertDailyAttendanceWithHistory(
          prisma,
          emp.id,
          d.date,
          { status: 'LOP', source: 'SYSTEM_AUTO' },
          { userId: userId || null, changedBySource: 'system_finalize' }
        );
      }
    }
  }

  // Phase 2 — auto-generate attendance rows for missing days via the history
  // helper so every insert has a proper audit trail. weeklyOff is resolved
  // once for every employee up front (two queries total) rather than per
  // employee per day, which is what made this route N+1 before.
  const weeklyOff = await buildWeeklyOffResolver(scope.companyId, employees.map((e) => e.id));
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
      const isWeeklyOff = weeklyOff.isWeeklyOff(emp.id, date);
      let status: string;
      if (isWeeklyOff) {
        status = 'WeeklyOff';
      } else if (holidayDates.has(dateStr)) {
        status = 'Holiday';
      } else {
        status = 'LOP';
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

  // Phase 3 — rollup the counts and set the finalized metadata.
  // refreshMonthlySummary computes the full summary including the approved
  // leave-type breakdown (CL, SL, EL, etc.).
  const results = await Promise.all(
    employees.map(async (e) => {
      await refreshMonthlySummary(e.id, year, month);
      return prisma.monthlyAttendanceSummary.update({
        where: { employeeId_year_month: { employeeId: e.id, year, month } },
        data: { status: 'FINALIZED', finalizedAt: now, finalizedByUserId: userId },
      });
    })
  );

  return NextResponse.json({ message: `Finalized ${results.length} employee(s)`, data: results });
}
