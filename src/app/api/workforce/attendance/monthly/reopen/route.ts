/**
 * POST /api/workforce/attendance/monthly/reopen
 * Body: { year, month, employeeId?, reason }
 *
 * Authorized reopen of a frozen month — reason is mandatory (BRD §29:
 * "capture reopen date/time, user, reason"). Moves status back to OPEN so
 * DailyAttendance rows can be corrected again; does not itself touch any
 * DailyAttendance data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { reopenMonthSchema } from '@/lib/validations/workforce';

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const month = Number(body?.month);
  const employeeIdFilter = body?.employeeId ? Number(body.employeeId) : undefined;

  if (!year || !month) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
  }

  const parsed = reopenMonthSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const userId = Number(request.headers.get('x-user-id'));

  const result = await prisma.monthlyAttendanceSummary.updateMany({
    where: {
      year,
      month,
      status: 'FROZEN',
      employee: { companyId: scope.companyId, deletedAt: null },
      ...(employeeIdFilter ? { employeeId: employeeIdFilter } : {}),
    },
    data: {
      status: 'OPEN',
      reopenedAt: new Date(),
      reopenedByUserId: userId,
      reopenReason: parsed.data.reason,
    },
  });

  return NextResponse.json({ message: `Reopened ${result.count} record(s)` });
}
