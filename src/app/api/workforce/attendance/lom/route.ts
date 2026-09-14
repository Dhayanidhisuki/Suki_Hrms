/**
 * GET /api/workforce/attendance/lom
 *   — lists DailyAttendance rows with lomApprovalStatus='pending',
 *     RBAC-gated on workforce.lom.view (or workforce.ot.approve as fallback).
 *   ?status=pending|approved|rejected  (default: pending)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.ot.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const status = request.nextUrl.searchParams.get('status') ?? 'pending';
  const validStatuses = ['pending', 'approved', 'rejected'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'status must be one of: pending, approved, rejected' }, { status: 400 });
  }

  const data = await prisma.dailyAttendance.findMany({
    where: {
      lomApprovalStatus: status,
      employee: { companyId: scope.companyId, isActive: true },
      OR: [
        { lateMinutes: { gt: 0 } },
        { earlyOutMinutes: { gt: 0 } },
      ],
    },
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      shiftMaster: { select: { id: true, code: true, name: true, startTime: true, endTime: true, graceMinutes: true } },
    },
    orderBy: { date: 'asc' },
  });

  return NextResponse.json({ data });
}
