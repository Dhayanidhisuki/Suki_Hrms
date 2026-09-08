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

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Wall-clock minutes since midnight — punches are stored via setUTCHours, so read back with the UTC getters. */
function wallClockMinutes(d: Date | null): number | null {
  if (!d) return null;
  return d.getUTCHours() * 60 + d.getUTCMinutes();
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

  const shiftNames = new Map(
    (shiftIds.size
      ? await prisma.shiftMaster.findMany({ where: { id: { in: Array.from(shiftIds) } }, select: { id: true, name: true, code: true } })
      : []
    ).map((s) => [s.id, s.name || s.code])
  );

  const today = new Date();
  const todayIso = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())).toISOString().slice(0, 10);

  const days = rawDays.map(({ date, iso, rec, shift, shiftMasterId }) => {
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
      shiftName: shiftMasterId ? shiftNames.get(shiftMasterId) ?? null : null,
      shiftMinutes: rec || shiftStart !== null ? shift.standardMinutes : 0,
      shiftStartMinutes: shiftStart,
      workingMinutes: rec?.workingMinutes ?? 0,
      lateMinutes: rec?.lateMinutes ?? 0,
      earlyOutMinutes: rec?.earlyOutMinutes ?? 0,
      preExtraMinutes,
      postExtraMinutes,
      otMinutesCalculated: rec?.otMinutesCalculated ?? 0,
      otMinutesApproved: rec?.otMinutesApproved ?? null,
      otApprovalStatus: rec?.otApprovalStatus ?? null,
      source: rec?.source ?? null,
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
    biometricDays: count((d) => d.source === 'biometric'),
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
