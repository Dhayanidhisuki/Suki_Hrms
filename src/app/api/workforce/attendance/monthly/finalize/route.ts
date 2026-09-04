/**
 * POST /api/workforce/attendance/monthly/finalize
 * Body: { year, month, employeeId? }
 *
 * Computes MonthlyAttendanceSummary from that month's DailyAttendance rows
 * (present/absent/leave/LOP day counts, OT/late/early-out minute totals) and
 * upserts it with status FINALIZED — the "Time Office Final" step, done for
 * one employee if employeeId is given, otherwise every active employee in
 * the company for that month.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

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

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const employees = await prisma.employee.findMany({
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

  if (employeeIdFilter && employees.length === 0) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const userId = Number(request.headers.get('x-user-id'));
  const now = new Date();
  const totalWorkingDays = daysInMonth(year, month);

  const results = await Promise.all(
    employees.map(async (e) => {
      const days = e.dailyAttendances;
      // presentDays is stored as Int; HalfDay rows add 0.5 and the running
      // total is rounded at write time — acceptable for Phase 1's summary
      // counts, not used for anything requiring exact fractional precision.
      let presentDays = 0;
      let absentDays = 0;
      let leaveDays = 0;
      let lopDays = 0;
      let otMinutesTotal = 0;
      let lateMinutesTotal = 0;
      let earlyOutMinutesTotal = 0;

      for (const d of days) {
        if (d.status === 'Present' || d.status === 'OnDuty') presentDays += 1;
        else if (d.status === 'HalfDay') presentDays += 0.5;
        else if (d.status === 'Absent') absentDays += 1;
        else if (d.status === 'Leave') leaveDays += 1;
        else if (d.status === 'LOP') lopDays += 1;
        otMinutesTotal += d.otMinutesApproved ?? d.otMinutesCalculated;
        lateMinutesTotal += d.lateMinutes;
        earlyOutMinutesTotal += d.earlyOutMinutes;
      }

      return prisma.monthlyAttendanceSummary.upsert({
        where: { employeeId_year_month: { employeeId: e.id, year, month } },
        update: {
          totalWorkingDays,
          presentDays: Math.round(presentDays),
          absentDays,
          leaveDays,
          lopDays,
          otMinutesTotal,
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
          totalWorkingDays,
          presentDays: Math.round(presentDays),
          absentDays,
          leaveDays,
          lopDays,
          otMinutesTotal,
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
