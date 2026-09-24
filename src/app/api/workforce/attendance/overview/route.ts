/**
 * GET /api/workforce/attendance/overview?employeeId=&year=&month=
 *
 * One employee's month, day by day, in the shape the Attendance Overview
 * page renders: every calendar date of the month (not just the dates that
 * have a DailyAttendance row), each with the stored punches/minutes, the
 * shift that applied that day (resolved from the employee's GENERAL /
 * ROTATIONAL assignment exactly the way the biometric conversion does), and
 * the derived pre-shift / post-shift extra time. Plus a summary block for
 * the panel under the grid and the month's OPEN/FINALIZED/FROZEN status.
 *
 * Everything here is read-only and derived — nothing is written back. Two
 * interpretations are added on top of stored data, both only for a date
 * with no punches (no row, or an Absent/LOP/MissingPunch row with no
 * in/out) since the biometric conversion writes 0-hour days as Absent and
 * neither a weekly-off nor a holiday concept feeds into it directly:
 *   - `inferredHoliday` — the date is in HolidayMaster for this company.
 *   - `inferredWeeklyOff` — the date is a Sunday and isn't already a holiday.
 * The stored status is still returned untouched in `storedStatus`, so
 * nothing is hidden.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveEmployeeShiftConfig, resolveDailyShift } from '@/lib/biometricConversion';
import { computeLomMinutes, computeOtPayableMinutes, parseShiftTime } from '@/lib/attendanceCalc';
import { getFreeHoursPerMonth } from '@/lib/permissionPolicy';

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Wall-clock minutes since midnight — punches are stored via setUTCHours, so read back with the UTC getters. */
function wallClockMinutes(d: Date | null): number | null {
  if (!d) return null;
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Same wall-clock rule, rendered as HH:MM for the permission tooltip. */
function wallClock(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const employeeId = Number(searchParams.get('employeeId'));
  const year = Number(searchParams.get('year'));
  const month = Number(searchParams.get('month'));
  if (!employeeId || !year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'employeeId, year and month (1-12) are required' }, { status: 400 });
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1)); // exclusive

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId: scope.companyId, deletedAt: null },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: {
          shiftAssignmentType: true,
          department: { select: { name: true } },
          designation: { select: { name: true } },
          shiftMaster: { select: { name: true, startTime: true, endTime: true } },
          shiftRotationPlan: { select: { name: true } },
        },
      },
      dailyAttendances: {
        where: { date: { gte: monthStart, lt: monthEnd } },
        orderBy: { date: 'asc' },
      },
      monthlyAttendance: { where: { year, month }, take: 1 },
    },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const shiftConfig = await resolveEmployeeShiftConfig(employee.id);
  const byDate = new Map(employee.dailyAttendances.map((r) => [r.date.toISOString().slice(0, 10), r]));

  const holidays = await prisma.holidayMaster.findMany({
    where: { companyId: scope.companyId, isActive: true, deletedAt: null, date: { gte: monthStart, lt: monthEnd } },
    select: { date: true, name: true },
  });
  const holidayByIso = new Map(holidays.map((h) => [h.date.toISOString().slice(0, 10), h.name]));

  const numDays = daysInMonth(year, month);
  const shiftIds = new Set<number>();
  const rawDays = Array.from({ length: numDays }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1, i + 1));
    const iso = date.toISOString().slice(0, 10);
    const rec = byDate.get(iso) ?? null;
    const shift = resolveDailyShift(shiftConfig, date);
    // Prefer the shift snapshotted on the row (what was actually applied) over today's resolution.
    const shiftMasterId = rec?.shiftMasterId ?? shift.shiftMasterId;
    if (shiftMasterId) shiftIds.add(shiftMasterId);
    return { date, iso, rec, shift, shiftMasterId };
  });

  const shiftMasters = new Map(
    (shiftIds.size
      ? await prisma.shiftMaster.findMany({ where: { id: { in: Array.from(shiftIds) } }, select: { id: true, name: true, code: true, startTime: true, endTime: true, graceMinutes: true } })
      : []
    ).map((s) => [s.id, s])
  );

  const [otPlan, lomConfig, permissionRequests, permissionFreeHours] = await Promise.all([
    prisma.oTPlan.findFirst({ where: { isActive: true, deletedAt: null } }),
    prisma.lomConfig.findUnique({ where: { companyId: scope.companyId } }),
    prisma.permissionRequest.findMany({
      where: { employeeId: employee.id, date: { gte: monthStart, lt: monthEnd } },
      orderBy: [{ date: 'asc' }, { fromTime: 'asc' }],
      select: {
        date: true,
        fromTime: true,
        toTime: true,
        hours: true,
        reason: true,
        status: true,
      },
    }),
    getFreeHoursPerMonth(scope.companyId),
  ]);

  // A day can carry more than one permission request (e.g. an hour in the
  // morning and half an hour in the evening), so the grid shows the day's
  // total hours plus one status: approved if anything on that day is
  // approved, otherwise pending, otherwise rejected. Rejected hours are
  // never counted into the day's or the month's totals.
  type PermissionEntry = { approvedHours: number; pendingHours: number; status: string; entries: string[] };
  const permissionByIso = new Map<string, PermissionEntry>();
  for (const p of permissionRequests) {
    const iso = p.date.toISOString().slice(0, 10);
    const entry = permissionByIso.get(iso) ?? { approvedHours: 0, pendingHours: 0, status: 'rejected', entries: [] };
    const hours = Number(p.hours);
    if (p.status === 'approved') {
      entry.approvedHours += hours;
      entry.status = 'approved';
    } else if (p.status === 'pending_manager' || p.status === 'pending_hr') {
      entry.pendingHours += hours;
      if (entry.status !== 'approved') entry.status = 'pending';
    }
    entry.entries.push(
      `${wallClock(p.fromTime)}–${wallClock(p.toTime)} · ${hours.toFixed(2)} h · ${p.status}${p.reason ? ` · ${p.reason}` : ''}`
    );
    permissionByIso.set(iso, entry);
  }
  const permissionApprovedHours = permissionRequests
    .filter((p) => p.status === 'approved')
    .reduce((acc, p) => acc + Number(p.hours), 0);
  const permissionPendingHours = permissionRequests
    .filter((p) => p.status === 'pending_manager' || p.status === 'pending_hr')
    .reduce((acc, p) => acc + Number(p.hours), 0);
  const permissionExcessHours = Math.max(0, permissionApprovedHours - permissionFreeHours);
  const lomCfg = lomConfig ? { graceMinutesExempt: lomConfig.graceMinutesExempt, dailyLomCap: lomConfig.dailyLomCap } : null;
  const otCfg = otPlan ? { applicableAfterMinutes: otPlan.applicableAfterMinutes, maxOtHoursPerDay: otPlan.maxOtHoursPerDay, roundingSlabMinutes: otPlan.roundingSlabMinutes } : null;

  const today = new Date();
  const todayIso = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())).toISOString().slice(0, 10);

  const days = rawDays.map(({ date, iso, rec, shift, shiftMasterId }) => {
    const perm = permissionByIso.get(iso) ?? null;
    const inMin = wallClockMinutes(rec?.inTime ?? null);
    let outMin = wallClockMinutes(rec?.outTime ?? null);

    const shiftStart = shift.startMinutes;
    const shiftEnd = shiftStart !== null ? shiftStart + shift.standardMinutes : null;
    const shiftCrossesMidnight = shiftEnd !== null && shiftEnd > 24 * 60;

    // An out-punch earlier than the in-punch is a genuine next-day out only
    // on a night shift; on a day shift it is a mis-punch (e.g. 17:37 in,
    // 17:29 out) and must not be read as a 24-hour day.
    let punchPairInvalid = false;
    if (inMin !== null && outMin !== null && outMin < inMin) {
      if (shiftCrossesMidnight) outMin += 24 * 60;
      else punchPairInvalid = true;
    }

    const preExtraMinutes = !punchPairInvalid && shiftStart !== null && inMin !== null ? Math.max(0, shiftStart - inMin) : 0;
    const postExtraMinutes = !punchPairInvalid && shiftEnd !== null && outMin !== null ? Math.max(0, outMin - shiftEnd) : 0;

    const isSunday = date.getUTCDay() === 0;
    const hasPunch = inMin !== null || outMin !== null;
    const storedStatus = rec?.status ?? null;
    const holidayName = holidayByIso.get(iso) ?? null;
    const noPunchDayOff = !hasPunch && (storedStatus === null || ['Absent', 'LOP', 'MissingPunch'].includes(storedStatus));
    // Holiday takes precedence over Sunday when a date is both (unusual but
    // possible) — one status per day, and "Holiday" carries the name.
    const inferredHoliday = Boolean(holidayName) && noPunchDayOff;
    const inferredWeeklyOff = !inferredHoliday && isSunday && noPunchDayOff;
    const status = inferredHoliday ? 'Holiday' : inferredWeeklyOff ? 'WeeklyOff' : storedStatus ?? (iso > todayIso ? 'Upcoming' : 'NoRecord');

    const shiftMaster = shiftMasterId ? shiftMasters.get(shiftMasterId) ?? null : null;
    const shiftMasterForCalc = shiftMaster
      ? { startTime: shiftMaster.startTime, endTime: shiftMaster.endTime, graceMinutes: shiftMaster.graceMinutes }
      : null;
    const lomMinutes = computeLomMinutes(
      rec?.lateMinutes ?? 0,
      rec?.earlyOutMinutes ?? 0,
      shiftMasterForCalc,
      lomCfg,
      Math.round((perm?.approvedHours ?? 0) * 60)
    );
    const shiftEndTod = shiftMasterForCalc ? parseShiftTime(shiftMasterForCalc.endTime) : undefined;
    const otPayableMinutes = computeOtPayableMinutes(rec?.otMinutesCalculated ?? 0, otCfg, shiftEndTod);

    return {
      date: iso,
      day: date.getUTCDate(),
      weekday: WEEKDAY[date.getUTCDay()],
      status,
      storedStatus,
      inferredWeeklyOff,
      inferredHoliday,
      holidayName,
      inTime: rec?.inTime ?? null,
      outTime: rec?.outTime ?? null,
      punchPairInvalid,
      shiftName: shiftMaster ? shiftMaster.name || shiftMaster.code : null,
      shiftMinutes: rec || shiftStart !== null ? shift.standardMinutes : 0,
      shiftStartMinutes: shiftStart,
      workingMinutes: rec?.workingMinutes ?? 0,
      lateMinutes: rec?.lateMinutes ?? 0,
      earlyOutMinutes: rec?.earlyOutMinutes ?? 0,
      preExtraMinutes,
      postExtraMinutes,
      otMinutesCalculated: rec?.otMinutesCalculated ?? 0,
      otPayableMinutes,
      lomMinutes,
      otMinutesApproved: rec?.otMinutesApproved ?? null,
      otApprovalStatus: rec?.otApprovalStatus ?? null,
      permissionHours: perm?.approvedHours ?? 0,
      permissionPendingHours: perm?.pendingHours ?? 0,
      permissionStatus: perm?.status ?? null,
      permissionDetail: perm ? perm.entries.join('\n') : null,
      source: rec?.source ?? null,
      inSource: rec?.inSource ?? null,
      outSource: rec?.outSource ?? null,
      remarks: rec?.remarks ?? null,
    };
  });

  const count = (pred: (d: (typeof days)[number]) => boolean) => days.filter(pred).length;
  const sum = (pick: (d: (typeof days)[number]) => number) => days.reduce((acc, d) => acc + pick(d), 0);

  const presentDays = count((d) => d.status === 'Present' || d.status === 'OnDuty') + 0.5 * count((d) => d.status === 'HalfDay');
  const weeklyOffDays = count((d) => d.status === 'WeeklyOff');
  const holidayDays = count((d) => d.status === 'Holiday');
  const leaveDays = count((d) => d.status === 'Leave');
  const lopDays = count((d) => d.status === 'LOP');
  const absentDays = count((d) => d.status === 'Absent');
  const paidDays = presentDays + weeklyOffDays + holidayDays + leaveDays;
  const workedDays = days.filter((d) => d.workingMinutes > 0);

  const summary = {
    totalDays: numDays,
    presentDays,
    weeklyOffDays,
    holidayDays,
    leaveDays,
    absentDays,
    lopDays,
    onDutyDays: count((d) => d.status === 'OnDuty'),
    halfDays: count((d) => d.status === 'HalfDay'),
    permissionDays: count((d) => d.status === 'Permission'),
    // Permission (short leave) is tracked as its own request, not as a day
    // status, so these come from PermissionRequest rather than the grid.
    permissionRequestDays: days.filter((d) => d.permissionHours > 0 || d.permissionPendingHours > 0).length,
    permissionApprovedHours,
    permissionPendingHours,
    permissionFreeHours,
    permissionExcessHours,
    missingPunchDays: count((d) => d.status === 'MissingPunch'),
    invalidPunchPairDays: count((d) => d.punchPairInvalid),
    paidDays,
    lateComeCount: count((d) => d.lateMinutes > 0),
    lateComeMinutes: sum((d) => d.lateMinutes),
    earlyGoCount: count((d) => d.earlyOutMinutes > 0),
    earlyGoMinutes: sum((d) => d.earlyOutMinutes),
    preExtraMinutes: sum((d) => d.preExtraMinutes),
    postExtraMinutes: sum((d) => d.postExtraMinutes),
    otCalculatedMinutes: sum((d) => d.otMinutesCalculated),
    otApprovedMinutes: sum((d) => d.otMinutesApproved ?? 0),
    otPendingCount: count((d) => d.otApprovalStatus === 'pending'),
    otRejectedCount: count((d) => d.otApprovalStatus === 'rejected'),
    shiftMinutes: workedDays.reduce((acc, d) => acc + d.shiftMinutes, 0),
    workingMinutes: sum((d) => d.workingMinutes),
    expectedWorkingMinutes: days
      .filter((d) => !['WeeklyOff', 'Holiday', 'Upcoming'].includes(d.status))
      .reduce((acc, d) => acc + d.shiftMinutes, 0),
    biometricDays: count((d) => d.source === 'biometric' || d.source === 'biometric+app'),
    appDays: count((d) => d.source === 'app' || d.source === 'biometric+app'),
    mergedDays: count((d) => d.source === 'biometric+app'),
    manualDays: count((d) => d.source === 'manual'),
  };

  const job = employee.jobInfos[0];
  const monthSummary = employee.monthlyAttendance[0] ?? null;

  return NextResponse.json({
    employee: {
      id: employee.id,
      employeeCode: employee.employeeCode,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      department: job?.department?.name ?? null,
      designation: job?.designation?.name ?? null,
      shiftAssignmentType: job?.shiftAssignmentType ?? 'GENERAL',
      shiftLabel:
        job?.shiftAssignmentType === 'ROTATIONAL'
          ? job.shiftRotationPlan?.name ?? 'Rotational (no plan)'
          : job?.shiftMaster
            ? `${job.shiftMaster.name} (${job.shiftMaster.startTime}–${job.shiftMaster.endTime})`
            : 'No shift assigned',
    },
    year,
    month,
    monthStatus: monthSummary?.status ?? 'OPEN',
    days,
    summary,
  });
}
