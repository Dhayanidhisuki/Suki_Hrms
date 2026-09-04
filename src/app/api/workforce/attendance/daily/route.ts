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
import { dailyAttendanceSchema } from '@/lib/validations/workforce';

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
      shiftMaster: { select: { id: true, code: true, name: true } },
    },
    orderBy: { employeeId: 'asc' },
  });

  return NextResponse.json({ data: records });
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

  const record = await prisma.dailyAttendance.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: { ...rest, updatedByUserId: userId },
    create: { employeeId, date, ...rest, createdByUserId: userId },
  });

  return NextResponse.json(record, { status: 201 });
}
