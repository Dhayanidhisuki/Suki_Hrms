/**
 * GET /api/workforce/attendance/time-office-final?year=YYYY&month=M
 *
 * Returns the Time Office final report — a per-employee grid showing:
 *   - Total/present/absent/leave/LOP days
 *   - OT hours (approved + pending)
 *   - Late minutes, early-out minutes
 *   - Permission hours used + excess
 *   - Comp-off balance
 *   - Weekly OT cap status
 *
 * This is the "final" view used before payroll processing — HR reviews
 * this grid to verify attendance is correct before running payroll.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { computeLomMinutes, computeOtPayableMinutes, parseShiftTime } from '@/lib/attendanceCalc';
import { getApprovedPermissionMinutes, excusedMinutesFor } from '@/lib/permissionExcuse';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? String(new Date().getUTCFullYear()));
  const month = parseInt(searchParams.get('month') ?? String(new Date().getUTCMonth() + 1));

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  // Load all employees for this company.
  const employees = await prisma.employee.findMany({
    where: { companyId: scope.companyId, deletedAt: null, isActive: true },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
    },
    orderBy: { employeeCode: 'asc' },
  });

  // Load monthly summaries for this month.
  const summaries = await prisma.monthlyAttendanceSummary.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      year,
      month,
    },
  });
  const summaryMap = new Map(summaries.map((s) => [s.employeeId, s]));

  // Load comp-off balances.
  const compOffBalances = await prisma.compOffBalance.findMany({
    where: { employeeId: { in: employees.map((e) => e.id) } },
  });
  const compOffMap = new Map(compOffBalances.map((b) => [b.employeeId, b]));

  // Load approved permission requests with excess for this month.
  const permissionRequests = await prisma.permissionRequest.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      date: { gte: monthStart, lt: monthEnd },
      status: 'approved',
    },
  });
  const permissionByEmp = new Map<number, { totalHours: number; excessHours: number }>();
  for (const p of permissionRequests) {
    const entry = permissionByEmp.get(p.employeeId) ?? { totalHours: 0, excessHours: 0 };
    entry.totalHours += Number(p.hours);
    entry.excessHours += Number(p.excessHours);
    permissionByEmp.set(p.employeeId, entry);
  }

  // Load OT plan for weekly cap.
  const otPlan = await prisma.oTPlan.findFirst({ where: { isActive: true, deletedAt: null } });
  const weeklyCapHours = otPlan?.maxOtHoursPerWeek ?? null;

  // Load LOM config for fallback grace + daily cap.
  const lomConfig = await prisma.lomConfig.findUnique({ where: { companyId: scope.companyId } });

  // Load all daily attendance rows for this month (with shift master grace)
  // so we can compute per-employee LOM minutes (after shift grace) and OT
  // payable minutes (after OT plan threshold) — matching payroll exactly.
  const dailyRows = await prisma.dailyAttendance.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      date: { gte: monthStart, lt: monthEnd },
      shiftMaster: { isNot: null },
    },
    include: {
      shiftMaster: { select: { startTime: true, endTime: true, graceMinutes: true } },
    },
  });

  // Approved permission for the month excuses the late/early time it covers.
  const permissionExcused = await getApprovedPermissionMinutes(
    employees.map((e) => e.id),
    monthStart,
    monthEnd
  );

  const lomByEmp = new Map<number, number>();
  const otPayableByEmp = new Map<number, number>();
  for (const d of dailyRows) {
    if (!['Present', 'HalfDay', 'OnDuty'].includes(d.status)) continue;
    const shift = d.shiftMaster
      ? { startTime: d.shiftMaster.startTime, endTime: d.shiftMaster.endTime, graceMinutes: d.shiftMaster.graceMinutes }
      : null;
    const lom = computeLomMinutes(d.lateMinutes, d.earlyOutMinutes, shift, lomConfig ? { graceMinutesExempt: lomConfig.graceMinutesExempt, dailyLomCap: lomConfig.dailyLomCap } : null, excusedMinutesFor(permissionExcused, d.employeeId, d.date));
    lomByEmp.set(d.employeeId, (lomByEmp.get(d.employeeId) ?? 0) + lom);
    const otPay = computeOtPayableMinutes(
      d.otMinutesCalculated,
      otPlan ? { applicableAfterMinutes: otPlan.applicableAfterMinutes, maxOtHoursPerDay: otPlan.maxOtHoursPerDay, roundingSlabMinutes: otPlan.roundingSlabMinutes } : null,
      shift ? parseShiftTime(shift.endTime) : undefined
    );
    otPayableByEmp.set(d.employeeId, (otPayableByEmp.get(d.employeeId) ?? 0) + otPay);
  }

  // Build the report rows.
  const rows = employees.map((emp) => {
    const summary = summaryMap.get(emp.id);
    const compOff = compOffMap.get(emp.id);
    const permission = permissionByEmp.get(emp.id);
    const otMinutes = summary?.otMinutesTotal ?? 0;
    const otHours = otMinutes / 60;
    const lomMinutes = lomByEmp.get(emp.id) ?? 0;
    const otPayableMinutes = otPayableByEmp.get(emp.id) ?? 0;
    const otPayableHours = otPayableMinutes / 60;
    return {
      id: emp.id,
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      name: `${emp.firstName} ${emp.lastName}`.trim(),
      totalWorkingDays: summary?.totalWorkingDays ?? 0,
      payableDays: summary ? Number(summary.payableDays) : 0,
      presentDays: summary ? Number(summary.presentDays) : 0,
      absentDays: summary ? Number(summary.absentDays) : 0,
      leaveDays: summary?.leaveDays ?? 0,
      lopDays: summary?.lopDays ?? 0,
      otHours: Number(otHours.toFixed(2)),
      otPayableHours: Number(otPayableHours.toFixed(2)),
      lomMinutes,
      lateMinutes: summary?.lateMinutesTotal ?? 0,
      earlyOutMinutes: summary?.earlyOutMinutesTotal ?? 0,
      permissionHours: permission ? Number(permission.totalHours.toFixed(2)) : 0,
      permissionExcessHours: permission ? Number(permission.excessHours.toFixed(2)) : 0,
      compOffBalance: compOff ? Number(compOff.balance) : 0,
      summaryStatus: summary?.status ?? 'OPEN',
      weeklyOtCapHours: weeklyCapHours,
      exceedsWeeklyCap: weeklyCapHours != null && otHours > weeklyCapHours,
    };
  });

  return NextResponse.json({
    period: { year, month },
    otPlan: otPlan ? { code: otPlan.code, weeklyCapHours, monthlyCapHours: otPlan.maxOtHoursPerMonth } : null,
    data: rows,
  });
}
