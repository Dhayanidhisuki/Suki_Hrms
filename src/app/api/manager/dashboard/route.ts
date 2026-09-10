/**
 * GET /api/manager/dashboard
 *
 * Returns the logged-in manager's team summary: headcount, today's
 * attendance breakdown, and pending approvals (mispunch, OT, leave,
 * permission) across all direct + indirect reports.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId, listAllReports } from '@/lib/reportingManager';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  // Get all direct + indirect reports
  const allReports = await listAllReports(ownEmployeeId);
  const reportIds = allReports.map((e) => e.id);

  if (reportIds.length === 0) {
    return NextResponse.json({
      teamSize: 0,
      presentToday: 0,
      absentToday: 0,
      onLeaveToday: 0,
      missingPunchToday: 0,
      pendingApprovals: { mispunch: 0, ot: 0, leave: 0, permission: 0, salaryRevision: 0 },
      teamList: [],
    });
  }

  // Today's attendance
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  const todayAttendance = await prisma.dailyAttendance.findMany({
    where: { employeeId: { in: reportIds }, date: { gte: todayStart, lt: todayEnd } },
    select: { status: true, employeeId: true },
  });

  const presentToday = todayAttendance.filter((a) => a.status === 'Present' || a.status === 'OnDuty').length;
  const absentToday = todayAttendance.filter((a) => a.status === 'Absent').length;
  const onLeaveToday = todayAttendance.filter((a) => a.status === 'Leave').length;
  const missingPunchToday = todayAttendance.filter((a) => a.status === 'MissingPunch').length;

  // Pending approvals
  const [pendingMispunch, pendingOT, pendingLeave, pendingPermission, pendingSalaryRevision] = await Promise.all([
    prisma.mispunchCorrection.count({
      where: { status: 'pending_manager', employeeId: { in: reportIds } },
    }),
    prisma.dailyAttendance.count({
      where: { otApprovalStatus: 'pending_manager', employeeId: { in: reportIds } },
    }),
    prisma.leaveApplication.count({
      where: { status: 'pending_manager', employeeId: { in: reportIds } },
    }),
    prisma.permissionRequest.count({
      where: { status: 'pending_manager', employeeId: { in: reportIds } },
    }),
    prisma.salaryRevisionRequest.count({
      where: { status: 'PENDING_MANAGER', employeeId: { in: reportIds } },
    }),
  ]);

  // Team list with today's status
  const teamList = await Promise.all(
    allReports.slice(0, 50).map(async (emp) => {
      const att = todayAttendance.find((a) => a.employeeId === emp.id);
      return {
        id: emp.id,
        employeeCode: emp.employeeCode,
        firstName: emp.firstName,
        lastName: emp.lastName,
        statusToday: att?.status ?? 'Not Marked',
      };
    })
  );

  return NextResponse.json({
    teamSize: reportIds.length,
    presentToday,
    absentToday,
    onLeaveToday,
    missingPunchToday,
    pendingApprovals: {
      mispunch: pendingMispunch,
      ot: pendingOT,
      leave: pendingLeave,
      permission: pendingPermission,
      salaryRevision: pendingSalaryRevision,
    },
    teamList,
  });
}
