/**
 * GET /api/workforce/my-attendance?year=YYYY&month=1-12
 *   The logged-in employee's own daily attendance for a month, plus the
 *   month's summary totals. Self-service: employeeId is resolved from the
 *   session, never taken from the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year'));
  const month = Number(searchParams.get('month'));
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year and month (1-12) are required' }, { status: 400 });
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const [days, summary] = await Promise.all([
    prisma.dailyAttendance.findMany({
      where: { employeeId: ownEmployeeId, date: { gte: monthStart, lt: monthEnd } },
      select: {
        id: true,
        date: true,
        status: true,
        inTime: true,
        outTime: true,
        workingMinutes: true,
        lateMinutes: true,
        earlyOutMinutes: true,
        otMinutesCalculated: true,
        otMinutesApproved: true,
        otApprovalStatus: true,
        shiftMaster: { select: { code: true, name: true } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.monthlyAttendanceSummary.findUnique({
      where: { employeeId_year_month: { employeeId: ownEmployeeId, year, month } },
    }),
  ]);

  return NextResponse.json({ data: days, summary });
}
