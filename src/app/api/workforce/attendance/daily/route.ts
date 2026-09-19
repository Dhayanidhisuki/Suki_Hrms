/**
 * GET  /api/workforce/attendance/daily?date=YYYY-MM-DD[&employeeId=]
 *      — one date's attendance across employees, or one employee's attendance
 *        on that date. Company-scoped.
 * POST /api/workforce/attendance/daily
 *      — mark/correct one employee's attendance for one date (upsert on the
 *        unique [employeeId, date] pair — re-marking the same day corrects it
 *        rather than erroring).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { refreshMonthlySummary } from '@/lib/biometricConversion';
import { dailyAttendanceSchema } from '@/lib/validations/workforce';
import { computeLomMinutes, computeOtPayableMinutes, computeAttendanceMetrics } from '@/lib/attendanceCalc';
import { getApprovedPermissionMinutes, excusedMinutesFor } from '@/lib/permissionExcuse';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');
  const employeeIdParam = searchParams.get('employeeId');

  if (!dateParam) {
    return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 });
  }
  const date = new Date(dateParam);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  const records = await prisma.dailyAttendance.findMany({
    where: {
      date,
      employee: { companyId: scope.companyId, deletedAt: null },
      ...(employeeIdParam ? { employeeId: Number(employeeIdParam) } : {}),
    },
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      shiftMaster: { select: { id: true, code: true, name: true, startTime: true, endTime: true, graceMinutes: true } },
    },
    orderBy: { employeeId: 'asc' },
  });

  // Load OT plan + LOM config so the API can return computed LOM (after shift
  // grace) and OT payable (after threshold) for each row — matching payroll.
  const [otPlan, lomConfig, permissionExcused] = await Promise.all([
    prisma.oTPlan.findFirst({ where: { isActive: true, deletedAt: null } }),
    prisma.lomConfig.findUnique({ where: { companyId: scope.companyId } }),
    // Approved permission on this date excuses that much late/early time.
    getApprovedPermissionMinutes(
      records.map((r) => r.employeeId),
      date,
      new Date(date.getTime() + 24 * 60 * 60 * 1000)
    ),
  ]);

  const data = records.map((r) => {
    const shift = r.shiftMaster
      ? { startTime: r.shiftMaster.startTime, endTime: r.shiftMaster.endTime, graceMinutes: r.shiftMaster.graceMinutes }
      : null;
    const permissionExcusedMinutes = excusedMinutesFor(permissionExcused, r.employeeId, r.date);
    const lomMinutes = computeLomMinutes(r.lateMinutes, r.earlyOutMinutes, shift, lomConfig ? { graceMinutesExempt: lomConfig.graceMinutesExempt, dailyLomCap: lomConfig.dailyLomCap } : null, permissionExcusedMinutes);
    const otPayableMinutes = computeOtPayableMinutes(r.otMinutesCalculated, otPlan ? { applicableAfterMinutes: otPlan.applicableAfterMinutes, maxOtHoursPerDay: otPlan.maxOtHoursPerDay } : null);
    return { ...r, lomMinutes, otPayableMinutes, permissionExcusedMinutes };
  });

  return NextResponse.json({
    data,
    otPlan: otPlan ? { applicableAfterMinutes: otPlan.applicableAfterMinutes, maxOtHoursPerDay: otPlan.maxOtHoursPerDay } : null,
    lomConfig: lomConfig ? { graceMinutesExempt: lomConfig.graceMinutesExempt, dailyLomCap: lomConfig.dailyLomCap } : null,
  });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = dailyAttendanceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const employee = await findEmployeeInCompany(parsed.data.employeeId, scope.companyId);
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const freezeErr = await checkMonthNotFrozen(parsed.data.employeeId, parsed.data.date);
  if (freezeErr) return freezeErr;

  const userId = Number(request.headers.get('x-user-id'));
  const { employeeId, date, ...rest } = parsed.data;

  // Auto-calculate late/early/OT/working from in/out times + assigned shift
  // master, so manual entry doesn't require HR to compute these by hand.
  // If a shiftMasterId is provided (or one is already assigned to the row),
  // load it and recompute. This keeps the stored values consistent with the
  // shift's start/end/grace — the same source payroll uses.
  let shiftMasterId = rest.shiftMasterId ?? null;
  let computed = {
    workingMinutes: rest.workingMinutes ?? 0,
    lateMinutes: rest.lateMinutes ?? 0,
    earlyOutMinutes: rest.earlyOutMinutes ?? 0,
    otMinutesCalculated: rest.otMinutesCalculated ?? 0,
  };

  if (rest.inTime && rest.outTime) {
    // If no shiftMasterId in payload, check the existing row
    if (!shiftMasterId) {
      const existing = await prisma.dailyAttendance.findUnique({
        where: { employeeId_date: { employeeId, date } },
        select: { shiftMasterId: true },
      });
      shiftMasterId = existing?.shiftMasterId ?? null;
    }
    if (shiftMasterId) {
      const sm = await prisma.shiftMaster.findUnique({
        where: { id: shiftMasterId },
        select: { startTime: true, endTime: true, graceMinutes: true },
      });
      if (sm) {
        computed = computeAttendanceMetrics(rest.inTime, rest.outTime, sm);
      }
    }
  }

  const dataToSave = {
    ...rest,
    shiftMasterId,
    workingMinutes: computed.workingMinutes,
    lateMinutes: computed.lateMinutes,
    earlyOutMinutes: computed.earlyOutMinutes,
    otMinutesCalculated: computed.otMinutesCalculated,
  };

  // Snapshots the superseded values into DailyAttendanceHistory when this
  // corrects an existing day, so a correction never loses what was there
  // before (and neither does a later biometric import overwriting this).
  const { outcome } = await upsertDailyAttendanceWithHistory(
    prisma,
    employeeId,
    date,
    dataToSave,
    { userId: userId || null, changedBySource: 'manual' }
  );

  // Keep MonthlyAttendanceSummary in sync with the upserted daily row
  const attDate = new Date(date);
  await refreshMonthlySummary(employeeId, attDate.getUTCFullYear(), attDate.getUTCMonth() + 1);

  const record = await prisma.dailyAttendance.findUnique({
    where: { employeeId_date: { employeeId, date } },
  });

  return NextResponse.json({ ...record, outcome }, { status: 201 });
}
