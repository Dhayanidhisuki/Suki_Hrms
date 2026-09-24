/**
 * GET /api/workforce/attendance/monthly?year=2026&month=9[&departmentId=][&designationId=][&employeeTypeId=][&unitId=]
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
  const designationId = searchParams.get('designationId');
  const employeeTypeId = searchParams.get('employeeTypeId');
  const unitId = searchParams.get('unitId');

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year and month (1-12) are required' }, { status: 400 });
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1)); // exclusive

  // Build job-info filter; jobInfos with effectiveTo == null are current.
  const jobInfoWhere: Record<string, unknown> = { effectiveTo: null };
  if (departmentId) jobInfoWhere.departmentId = Number(departmentId);
  if (designationId) jobInfoWhere.designationId = Number(designationId);
  if (employeeTypeId) jobInfoWhere.employeeTypeId = Number(employeeTypeId);
  if (unitId) jobInfoWhere.unitId = Number(unitId);
  const hasJobFilter = departmentId || designationId || employeeTypeId || unitId;

  const employees = await prisma.employee.findMany({
    where: {
      companyId: scope.companyId,
      deletedAt: null,
      isActive: true,
      ...(hasJobFilter ? { jobInfos: { some: jobInfoWhere } } : {}),
    },
    select: {
      id: true,
      employeeCode: true,
      oldEmployeeCode: true,
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
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        orderBy: { effectiveFrom: 'desc' },
        select: {
          department: { select: { name: true } },
          designation: { select: { name: true } },
          employeeType: { select: { name: true } },
        },
      },
    },
    orderBy: { employeeCode: 'asc' },
  });

  // Resolve reopenedByUserId -> a display name so the UI can show "Reopened
  // by <name>" without a second round-trip; the summary already carries
  // reopenedByUserId/reopenReason/reopenedAt, just never a human-readable name.
  const reopenerIds = Array.from(
    new Set(employees.map((e) => e.monthlyAttendance[0]?.reopenedByUserId).filter((id): id is number => !!id))
  );
  const reopeners = reopenerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: reopenerIds } },
        select: { id: true, email: true, employee: { select: { firstName: true, lastName: true } } },
      })
    : [];
  const reopenerNames = new Map(
    reopeners.map((u) => [u.id, u.employee ? `${u.employee.firstName} ${u.employee.lastName}`.trim() : u.email])
  );

  const data = employees.map((e) => {
    const summary = e.monthlyAttendance[0] ?? null;
    const job = e.jobInfos[0];
    return {
      employeeId: e.id,
      employeeCode: e.employeeCode,
      oldEmployeeCode: e.oldEmployeeCode,
      name: `${e.firstName} ${e.lastName}`.trim(),
      department: job?.department?.name ?? null,
      designation: job?.designation?.name ?? null,
      employeeType: job?.employeeType?.name ?? null,
      // GPS stays server-side for now — strip it, keep the endpoint
      // source attribution for the grid's source tooltip.
      days: e.dailyAttendances.map(({ inLatitude, inLongitude, outLatitude, outLongitude, ...d }) => {
        void inLatitude; void inLongitude; void outLatitude; void outLongitude;
        return d;
      }),
      summary: summary
        ? { ...summary, reopenedByName: summary.reopenedByUserId ? reopenerNames.get(summary.reopenedByUserId) ?? null : null }
        : null,
    };
  });

  return NextResponse.json({ data, year, month });
}
