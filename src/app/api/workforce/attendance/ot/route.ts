/**
 * GET /api/workforce/attendance/ot?scope=manager|hr
 *   — manager: DailyAttendance days with otApprovalStatus='pending_manager'
 *     where the logged-in employee is the requester's own Reporting
 *     Manager (hierarchy-gated, not RBAC — same pattern as Mispunch).
 *   — hr: days with otApprovalStatus='pending_hr' (RBAC-gated on
 *     workforce.ot.view). Rows land in either queue automatically the
 *     moment a write gives a day real, eligible OT minutes — see
 *     upsertDailyAttendanceWithHistory's auto-queue logic in
 *     src/lib/attendanceHistory.ts. There is no employee-submission step:
 *     OT approval is always after-the-fact on already-calculated minutes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const scopeParam = request.nextUrl.searchParams.get('scope') ?? 'manager';
  const include = {
    employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, reportingManagerId: true } },
  };

  if (scopeParam === 'manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId) {
      return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
    }
    const data = await prisma.dailyAttendance.findMany({
      where: { otApprovalStatus: 'pending_manager', employee: { reportingManagerId: ownEmployeeId, companyId: scope.companyId } },
      include,
      orderBy: { date: 'asc' },
    });
    return NextResponse.json({ data });
  }

  if (scopeParam === 'hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.ot.view');
    if (permErr) return permErr;
    const data = await prisma.dailyAttendance.findMany({
      where: { otApprovalStatus: 'pending_hr', employee: { companyId: scope.companyId } },
      include,
      orderBy: { date: 'asc' },
    });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: 'scope must be one of: manager, hr' }, { status: 400 });
}
