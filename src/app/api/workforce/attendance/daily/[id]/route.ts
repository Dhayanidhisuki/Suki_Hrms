/**
 * PUT /api/workforce/attendance/daily/[id]
 *
 * Correct an existing attendance row. Unlike the initial POST (upsert),
 * corrections here require a non-empty `remarks` — this is the audit trail
 * for "why did present-days change after the fact", not a silent overwrite.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { checkMonthNotFrozen } from '@/lib/attendanceFreeze';
import { dailyAttendanceSchema } from '@/lib/validations/workforce';

import { upsertDailyAttendanceWithHistory } from '@/lib/attendanceHistory';
import { refreshMonthlySummary } from '@/lib/biometricConversion';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const attendanceId = parseInt(id);

  const existing = await prisma.dailyAttendance.findFirst({
    where: { id: attendanceId, employee: { companyId: scope.companyId, deletedAt: null } },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const freezeErr = await checkMonthNotFrozen(existing.employeeId, existing.date);
  if (freezeErr) return freezeErr;

  const body = await request.json().catch(() => null);
  if (!body?.remarks || typeof body.remarks !== 'string' || !body.remarks.trim()) {
    return NextResponse.json({ error: 'remarks is required when correcting attendance' }, { status: 400 });
  }

  const parsed = dailyAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const userId = Number(request.headers.get('x-user-id'));

  await upsertDailyAttendanceWithHistory(
    prisma,
    existing.employeeId,
    existing.date,
    {
      shiftMasterId: parsed.data.shiftMasterId,
      status: parsed.data.status,
      inTime: parsed.data.inTime,
      outTime: parsed.data.outTime,
      workingMinutes: parsed.data.workingMinutes,
      lateMinutes: parsed.data.lateMinutes,
      earlyOutMinutes: parsed.data.earlyOutMinutes,
      otMinutesCalculated: parsed.data.otMinutesCalculated,
      remarks: parsed.data.remarks,
      source: 'manual',
    },
    { userId, changedBySource: 'manual' }
  );

  await refreshMonthlySummary(
    existing.employeeId,
    existing.date.getUTCFullYear(),
    existing.date.getUTCMonth() + 1
  );

  const record = await prisma.dailyAttendance.findUnique({ where: { id: attendanceId } });
  return NextResponse.json(record);
}
