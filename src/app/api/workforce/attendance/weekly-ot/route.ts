/**
 * GET /api/workforce/attendance/weekly-ot?employeeId=X&weekStart=YYYY-MM-DD
 *
 * Returns the weekly OT accumulation for an employee, computed from
 * DailyAttendance rows. Used by the Time Office page to enforce weekly OT
 * caps (OTPlan.maxOtHoursPerWeek) and to show the weekly OT breakdown.
 *
 * If no weekStart is given, returns the current week (Monday-Sunday).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

function getWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = d.getUTCDay(); // 0=Sunday, 1=Monday
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const weekStartParam = searchParams.get('weekStart');

  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
  }

  const empId = Number(employeeId);
  const weekStart = weekStartParam
    ? new Date(Date.UTC(parseInt(weekStartParam.slice(0, 4)), parseInt(weekStartParam.slice(5, 7)) - 1, parseInt(weekStartParam.slice(8, 10))))
    : getWeekStart(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  // Load daily attendance for the week.
  const dailyRecords = await prisma.dailyAttendance.findMany({
    where: {
      employeeId: empId,
      date: { gte: weekStart, lte: weekEnd },
    },
    orderBy: { date: 'asc' },
  });

  // Sum OT minutes (approved > calculated, but use approved when available).
  let totalOtMinutes = 0;
  let approvedOtMinutes = 0;
  let pendingOtMinutes = 0;
  const dayBreakdown = dailyRecords.map((d) => {
    const otMin = d.otMinutesApproved ?? d.otMinutesCalculated ?? 0;
    const isApproved = d.otApprovalStatus === 'approved';
    totalOtMinutes += otMin;
    if (isApproved) approvedOtMinutes += otMin;
    else if (d.otApprovalStatus === 'pending_manager' || d.otApprovalStatus === 'pending_hr') pendingOtMinutes += otMin;
    return {
      date: d.date.toISOString().slice(0, 10),
      dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.date.getUTCDay()],
      otMinutesCalculated: d.otMinutesCalculated ?? 0,
      otMinutesApproved: d.otMinutesApproved,
      otApprovalStatus: d.otApprovalStatus,
      otSettlementType: d.otSettlementType,
      status: d.status,
    };
  });

  // Load OTPlan for weekly cap.
  const otPlan = await prisma.oTPlan.findFirst({ where: { isActive: true, deletedAt: null } });
  const weeklyCapHours = otPlan?.maxOtHoursPerWeek ?? null;
  const totalOtHours = totalOtMinutes / 60;
  const exceedsCap = weeklyCapHours != null && totalOtHours > weeklyCapHours;

  return NextResponse.json({
    employeeId: empId,
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    totalOtMinutes,
    totalOtHours: Number(totalOtHours.toFixed(2)),
    approvedOtMinutes,
    approvedOtHours: Number((approvedOtMinutes / 60).toFixed(2)),
    pendingOtMinutes,
    pendingOtHours: Number((pendingOtMinutes / 60).toFixed(2)),
    weeklyCapHours,
    exceedsCap,
    dayBreakdown,
  });
}
