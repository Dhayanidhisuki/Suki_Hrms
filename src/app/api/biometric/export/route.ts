/**
 * GET /api/biometric/export?year=X&month=Y&format=csv
 *
 * Exports biometric/daily attendance data for a month as CSV.
 * Supports filtering by employeeId and status (BRD §21).
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
  const employeeId = searchParams.get('employeeId');
  const status = searchParams.get('status');

  if (!year || !month) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
  }

  const where: Record<string, unknown> = {
    employee: { companyId: scope.companyId, deletedAt: null },
    date: {
      gte: new Date(Date.UTC(year, month - 1, 1)),
      lt: new Date(Date.UTC(year, month, 1)),
    },
  };
  if (employeeId) where.employeeId = Number(employeeId);
  if (status) where.status = status;

  const rows = await prisma.dailyAttendance.findMany({
    where,
    include: {
      employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      shiftMaster: { select: { code: true, name: true } },
    },
    orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
  });

  // Build CSV.
  const headers = [
    'Employee Code', 'Employee Name', 'Date', 'Shift', 'Status',
    'In Time', 'Out Time', 'Working Minutes', 'OT Minutes', 'Late Minutes',
    'Early Out Minutes', 'Is Holiday Worked', 'Is Weekly Off Worked',
  ];

  const csvLines = [headers.join(',')];
  for (const r of rows) {
    const empName = `${r.employee.firstName} ${r.employee.lastName}`.trim();
    const dateStr = r.date.toISOString().split('T')[0];
    const inTime = r.inTime ? r.inTime.toTimeString().split(' ')[0] : '';
    const outTime = r.outTime ? r.outTime.toTimeString().split(' ')[0] : '';
    const values = [
      r.employee.employeeCode,
      `"${empName}"`,
      dateStr,
      r.shiftMaster?.code ?? '',
      r.status,
      inTime,
      outTime,
      r.workingMinutes ?? 0,
      r.otMinutesApproved ?? 0,
      r.lateMinutes ?? 0,
      r.earlyOutMinutes ?? 0,
      r.isHolidayWorked ? 'Yes' : 'No',
      r.isWeeklyOffWorked ? 'Yes' : 'No',
    ];
    csvLines.push(values.join(','));
  }

  const csv = csvLines.join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="attendance_${year}_${month}.csv"`,
    },
  });
}
