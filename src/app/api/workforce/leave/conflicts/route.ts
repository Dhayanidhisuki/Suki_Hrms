/**
 * GET /api/workforce/leave/conflicts
 *
 * The HR queue of punches that landed on approved leave days (leave core,
 * 2026-09-25). The sync / import paths never apply such a punch; they store
 * it on the day row (leaveConflict*) and HR decides here:
 * POST /api/workforce/leave/conflicts/[attendanceId]/resolve.
 *
 * Rows: leaveConflictInTime set, no decision yet, company-scoped. Requires
 * workforce.leave.approve. `?scope=decided` lists what has been decided
 * (newest first) so the approver keeps a record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.leave.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const decided = request.nextUrl.searchParams.get('scope') === 'decided';

  const rows = await prisma.dailyAttendance.findMany({
    where: {
      leaveConflictInTime: { not: null },
      leaveConflictDecision: decided ? { not: null } : null,
      employee: { companyId: scope.companyId, deletedAt: null },
    },
    select: {
      id: true,
      date: true,
      status: true,
      leaveDayKind: true,
      leaveApplicationId: true,
      leaveConflictInTime: true,
      leaveConflictOutTime: true,
      leaveConflictSource: true,
      leaveConflictDecision: true,
      leaveConflictDecidedAt: true,
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      leaveApplication: {
        select: {
          id: true,
          fromDate: true,
          toDate: true,
          numberOfDays: true,
          daysReversed: true,
          status: true,
          isHalfDay: true,
          leaveMaster: { select: { code: true, name: true, isPaid: true } },
        },
      },
    },
    orderBy: decided ? { leaveConflictDecidedAt: 'desc' } : { date: 'asc' },
    take: decided ? 50 : undefined,
  });

  return NextResponse.json({ data: rows });
}
