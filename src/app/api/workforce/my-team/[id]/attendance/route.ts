/**
 * GET /api/workforce/my-team/[id]/attendance?year=YYYY&month=1-12
 *   One direct report's day-by-day attendance for a month — check-in,
 *   check-out, status — the same shape the ESS dashboard uses for the
 *   logged-in employee's own month. Hierarchy-gated, not RBAC-gated: only
 *   the employee's own reporting manager (Level 1 or 2) may view it, matching
 *   the approval workflows' first-stage gate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId, isManagerOfAnyLevel } from '@/lib/reportingManager';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const { id } = await params;
  const employeeId = Number(id);
  if (!Number.isFinite(employeeId)) {
    return NextResponse.json({ error: 'Invalid employee id' }, { status: 400 });
  }

  const allowed = await isManagerOfAnyLevel(ownEmployeeId, employeeId);
  if (!allowed) {
    return NextResponse.json({ error: 'Not your report' }, { status: 403 });
  }

  const now = new Date();
  const year = Number(request.nextUrl.searchParams.get('year')) || now.getUTCFullYear();
  const month = Number(request.nextUrl.searchParams.get('month')) || now.getUTCMonth() + 1;
  if (month < 1 || month > 12) {
    return NextResponse.json({ error: 'month must be 1-12' }, { status: 400 });
  }
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: {
      id: true,
      oldEmployeeCode: true,
      firstName: true,
      lastName: true,
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: { designation: { select: { name: true } }, department: { select: { name: true } } },
      },
    },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const [days, leaveBalances] = await Promise.all([
    prisma.dailyAttendance.findMany({
      where: { employeeId, date: { gte: monthStart, lt: monthEnd } },
      select: {
        id: true,
        date: true,
        status: true,
        inTime: true,
        outTime: true,
        workingMinutes: true,
        lateMinutes: true,
        earlyOutMinutes: true,
        shiftMaster: { select: { code: true, name: true } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.leaveBalance.findMany({
      where: { employeeId, year, leaveMaster: { deletedAt: null } },
      select: { closingBalance: true, availed: true, leaveMaster: { select: { id: true, name: true } } },
      orderBy: { leaveMaster: { name: 'asc' } },
    }),
  ]);

  return NextResponse.json({
    employee: {
      id: employee.id,
      employeeCode: employee.oldEmployeeCode,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      designation: employee.jobInfos[0]?.designation?.name ?? null,
      department: employee.jobInfos[0]?.department?.name ?? null,
    },
    year,
    month,
    days,
    leaveByType: leaveBalances.map((b) => ({
      leaveMasterId: b.leaveMaster.id,
      name: b.leaveMaster.name,
      available: Number(Number(b.closingBalance).toFixed(1)),
      used: Number(Number(b.availed).toFixed(1)),
    })),
  });
}
