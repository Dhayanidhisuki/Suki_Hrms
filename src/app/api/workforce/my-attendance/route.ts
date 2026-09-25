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

  const [days, summary, overlappingLeaves] = await Promise.all([
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
        lomApprovalStatus: true,
        lomApprovedMinutes: true,
        shiftMaster: { select: { code: true, name: true } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.monthlyAttendanceSummary.findUnique({
      where: { employeeId_year_month: { employeeId: ownEmployeeId, year, month } },
    }),
    // A day can be both "Present" (real punch, kept by
    // commitLeaveApproval's skip-if-present guard) AND covered by an
    // approved/pending leave — the UI composes those into a
    // "Present (Leave/Comp-Off Applied)" badge instead of the two facts
    // silently conflicting.
    prisma.leaveApplication.findMany({
      where: {
        employeeId: ownEmployeeId,
        status: { in: ['pending_manager', 'pending_hr', 'approved'] },
        fromDate: { lt: monthEnd },
        toDate: { gte: monthStart },
      },
      select: { fromDate: true, toDate: true, status: true, leaveMaster: { select: { code: true } } },
    }),
  ]);

  const leaveByDate = new Map<string, { status: string; leaveCode: string }>();
  for (const leave of overlappingLeaves) {
    const cursor = new Date(Date.UTC(leave.fromDate.getUTCFullYear(), leave.fromDate.getUTCMonth(), leave.fromDate.getUTCDate()));
    const end = new Date(Date.UTC(leave.toDate.getUTCFullYear(), leave.toDate.getUTCMonth(), leave.toDate.getUTCDate()));
    while (cursor <= end) {
      leaveByDate.set(cursor.toISOString().slice(0, 10), { status: leave.status, leaveCode: leave.leaveMaster.code });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const daysWithLeaveFlag = days.map((d) => {
    const applied = leaveByDate.get(d.date.toISOString().slice(0, 10));
    return d.status === 'Present' && applied
      ? { ...d, appliedLeave: applied }
      : { ...d, appliedLeave: null };
  });

  return NextResponse.json({ data: daysWithLeaveFlag, summary });
}
