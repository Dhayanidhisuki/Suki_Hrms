/**
 * GET /api/workforce/my-team
 *   Direct reports of the logged-in employee (Level-1 only — matches what a
 *   reporting manager actually manages day to day), each with this year's
 *   leave available/used totals summed across all leave types. Self-service:
 *   the manager is resolved from the session, never taken from the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const year = Number(request.nextUrl.searchParams.get('year')) || new Date().getUTCFullYear();

  const reports = await prisma.employee.findMany({
    where: { reportingManagerId: ownEmployeeId, deletedAt: null, isActive: true },
    select: {
      id: true,
      oldEmployeeCode: true,
      firstName: true,
      lastName: true,
      profilePhotoPath: true,
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: { designation: { select: { name: true } }, department: { select: { name: true } } },
      },
      leaveBalances: {
        // A soft-deleted leave type (Masters > Leave Master) should stop
        // showing up here even though old LeaveBalance rows for it remain.
        where: { year, leaveMaster: { deletedAt: null } },
        select: {
          closingBalance: true,
          availed: true,
          leaveMaster: { select: { id: true, code: true, name: true } },
        },
      },
    },
    orderBy: { firstName: 'asc' },
  });

  const data = reports.map((e) => {
    const available = e.leaveBalances.reduce((sum, b) => sum + Number(b.closingBalance), 0);
    const used = e.leaveBalances.reduce((sum, b) => sum + Number(b.availed), 0);
    return {
      id: e.id,
      employeeCode: e.oldEmployeeCode,
      name: `${e.firstName} ${e.lastName}`.trim(),
      photoPath: e.profilePhotoPath,
      designation: e.jobInfos[0]?.designation?.name ?? null,
      department: e.jobInfos[0]?.department?.name ?? null,
      leaveAvailable: Number(available.toFixed(1)),
      leaveUsed: Number(used.toFixed(1)),
      leaveByType: e.leaveBalances
        .map((b) => ({
          leaveMasterId: b.leaveMaster.id,
          code: b.leaveMaster.code,
          name: b.leaveMaster.name,
          available: Number(Number(b.closingBalance).toFixed(1)),
          used: Number(Number(b.availed).toFixed(1)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

  return NextResponse.json({ data, year });
}
