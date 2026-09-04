/**
 * GET /api/workforce/attendance/monthly?year=2026&month=9[&departmentId=][&unitId=]
 *
 * The Monthly Attendance grid's data source: every active employee in the
 * caller's company (optionally filtered), each with their full month of
 * DailyAttendance rows and, if one exists, the MonthlyAttendanceSummary
 * (which also carries the OPEN/FINALIZED/FROZEN status the UI needs to know
 * whether editing is allowed).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year'));
  const month = Number(searchParams.get('month'));
  const departmentId = searchParams.get('departmentId');
  const unitId = searchParams.get('unitId');

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year and month (1-12) are required' }, { status: 400 });
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1)); // exclusive

  const employees = await prisma.employee.findMany({
    where: {
      companyId: scope.companyId,
      deletedAt: null,
      isActive: true,
      ...(departmentId || unitId
        ? {
            jobInfos: {
              some: {
                effectiveTo: null,
                ...(departmentId ? { departmentId: Number(departmentId) } : {}),
                ...(unitId ? { unitId: Number(unitId) } : {}),
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      dailyAttendances: {
        where: { date: { gte: monthStart, lt: monthEnd } },
        orderBy: { date: 'asc' },
      },
      monthlyAttendance: {
        where: { year, month },
        take: 1,
      },
    },
    orderBy: { employeeCode: 'asc' },
  });

  const data = employees.map((e) => ({
    employeeId: e.id,
    employeeCode: e.employeeCode,
    name: `${e.firstName} ${e.lastName}`.trim(),
    days: e.dailyAttendances,
    summary: e.monthlyAttendance[0] ?? null,
  }));

  return NextResponse.json({ data, year, month });
}
