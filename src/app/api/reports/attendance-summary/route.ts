/**
 * GET /api/reports/attendance-summary?year=X&month=Y
 *
 * Company-level attendance summary report — totals by status, LOP,
 * OT, late, early-out. Supports CSV export via ?format=csv.
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
  const year = parseInt(searchParams.get('year') ?? '0');
  const month = parseInt(searchParams.get('month') ?? '0');
  const format = searchParams.get('format');

  if (!year || !month) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
  }

  const summaries = await prisma.monthlyAttendanceSummary.findMany({
    where: {
      year, month,
      employee: { companyId: scope.companyId, deletedAt: null },
    },
    include: {
      employee: {
        select: {
          employeeCode: true, firstName: true, lastName: true,
          jobInfos: { where: { effectiveTo: null }, take: 1, select: { department: { select: { name: true } } } },
        },
      },
    },
  });

  const totals = summaries.reduce(
    (acc, s) => {
      acc.totalWorkingDays += s.totalWorkingDays;
      acc.payableDays += Number(s.payableDays);
      acc.lopDays += Number(s.lopDays);
      acc.otMinutesTotal += Number(s.otMinutesTotal ?? 0);
      acc.lateMinutesTotal += Number(s.lateMinutesTotal ?? 0);
      acc.earlyOutMinutesTotal += Number(s.earlyOutMinutesTotal ?? 0);
      acc.permissionHours += Number(s.permissionHours ?? 0);
      acc.permissionExcessHours += Number(s.permissionExcessHours ?? 0);
      acc.holidayWorkedDays += Number(s.holidayWorkedDays ?? 0);
      return acc;
    },
    { totalWorkingDays: 0, payableDays: 0, lopDays: 0, otMinutesTotal: 0, lateMinutesTotal: 0, earlyOutMinutesTotal: 0, permissionHours: 0, permissionExcessHours: 0, holidayWorkedDays: 0 }
  );

  // By department.
  const byDept = new Map<string, { count: number; lopDays: number; otMinutes: number; lateMinutes: number }>();
  for (const s of summaries) {
    const dept = s.employee.jobInfos[0]?.department?.name ?? 'Unknown';
    const existing = byDept.get(dept) ?? { count: 0, lopDays: 0, otMinutes: 0, lateMinutes: 0 };
    existing.count++;
    existing.lopDays += Number(s.lopDays);
    existing.otMinutes += Number(s.otMinutesTotal ?? 0);
    existing.lateMinutes += Number(s.lateMinutesTotal ?? 0);
    byDept.set(dept, existing);
  }

  const report = {
    period: { year, month },
    headcount: summaries.length,
    totals,
    byDepartment: Array.from(byDept.entries()).map(([dept, data]) => ({ department: dept, ...data })),
    employees: summaries.map((s) => ({
      employeeCode: s.employee.employeeCode,
      name: `${s.employee.firstName} ${s.employee.lastName}`.trim(),
      totalWorkingDays: s.totalWorkingDays,
      payableDays: Number(s.payableDays),
      lopDays: Number(s.lopDays),
      otMinutes: Number(s.otMinutesTotal ?? 0),
      lateMinutes: Number(s.lateMinutesTotal ?? 0),
      earlyOutMinutes: Number(s.earlyOutMinutesTotal ?? 0),
      status: s.status,
    })),
  };

  if (format === 'csv') {
    const headers = ['Code', 'Name', 'Working Days', 'Payable Days', 'LOP Days', 'OT Min', 'Late Min', 'Early Out Min', 'Status'];
    const rows = report.employees.map((e) => [
      e.employeeCode, `"${e.name}"`, String(e.totalWorkingDays), String(e.payableDays),
      String(e.lopDays), String(e.otMinutes), String(e.lateMinutes), String(e.earlyOutMinutes), e.status,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="attendance_${year}_${month}.csv"` },
    });
  }

  return NextResponse.json(report);
}
