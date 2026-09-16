/**
 * GET /api/reports/attendance/leave-summary?year=X&month=Y&format=csv
 *
 * Leave Report — leave applications per employee for a selected period
 * with leave type, dates, days, status, and current leave balances.
 * Also includes a by-leave-type summary and status breakdown.
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

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  // ── Fetch leave applications for the month ──
  const applications = await prisma.leaveApplication.findMany({
    where: {
      employee: { companyId: scope.companyId, deletedAt: null },
      OR: [
        { fromDate: { gte: monthStart, lt: monthEnd } },
        { toDate: { gte: monthStart, lt: monthEnd } },
      ],
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          jobInfos: {
            where: { effectiveTo: null },
            take: 1,
            select: { department: { select: { name: true } } },
          },
        },
      },
      leaveMaster: {
        select: { id: true, code: true, name: true, isPaid: true },
      },
    },
    orderBy: { employee: { employeeCode: 'asc' } },
  });

  // ── Fetch leave balances for the year ──
  const balances = await prisma.leaveBalance.findMany({
    where: {
      employee: { companyId: scope.companyId, deletedAt: null },
      year,
    },
    include: {
      employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      leaveMaster: { select: { code: true, name: true } },
    },
  });

  // ── Build application rows ──
  const appRows = applications.map((a) => ({
    id: a.id,
    employeeCode: a.employee.employeeCode,
    employeeName: `${a.employee.firstName} ${a.employee.lastName ?? ''}`.trim(),
    department: a.employee.jobInfos[0]?.department?.name ?? '—',
    leaveTypeCode: a.leaveMaster.code,
    leaveTypeName: a.leaveMaster.name,
    isPaid: a.leaveMaster.isPaid,
    fromDate: a.fromDate.toISOString().slice(0, 10),
    toDate: a.toDate.toISOString().slice(0, 10),
    numberOfDays: Number(a.numberOfDays),
    isHalfDay: a.isHalfDay,
    calendarDays: a.calendarDays ? Number(a.calendarDays) : null,
    status: a.status,
    reason: a.reason,
    appliedAt: a.appliedAt.toISOString().slice(0, 10),
    approvedAt: a.approvedAt ? a.approvedAt.toISOString().slice(0, 10) : null,
    rejectionReason: a.rejectionReason,
  }));

  // ── Build balance rows ──
  const balanceRows = balances.map((b) => ({
    employeeCode: b.employee.employeeCode,
    employeeName: `${b.employee.firstName} ${b.employee.lastName ?? ''}`.trim(),
    leaveTypeCode: b.leaveMaster.code,
    leaveTypeName: b.leaveMaster.name,
    openingBalance: Number(b.openingBalance),
    accrued: Number(b.accrued),
    availed: Number(b.availed),
    adjusted: Number(b.adjusted),
    closingBalance: Number(b.closingBalance),
    encashed: Number(b.encashed),
    lapsed: Number(b.lapsed),
    expired: Number(b.expired),
    pendingApproval: Number(b.pendingApproval),
  }));

  // ── By leave type summary ──
  const byLeaveType = new Map<string, { leaveType: string; count: number; days: number; approved: number; pending: number; rejected: number }>();
  for (const a of appRows) {
    const key = a.leaveTypeCode;
    const entry = byLeaveType.get(key) ?? { leaveType: a.leaveTypeName, count: 0, days: 0, approved: 0, pending: 0, rejected: 0 };
    entry.count++;
    entry.days += a.numberOfDays;
    if (a.status === 'approved') entry.approved++;
    else if (a.status.startsWith('pending')) entry.pending++;
    else if (a.status === 'rejected') entry.rejected++;
    byLeaveType.set(key, entry);
  }

  // ── Status summary ──
  const statusSummary = {
    total: appRows.length,
    approved: appRows.filter((a) => a.status === 'approved').length,
    pendingManager: appRows.filter((a) => a.status === 'pending_manager').length,
    pendingHr: appRows.filter((a) => a.status === 'pending_hr').length,
    rejected: appRows.filter((a) => a.status === 'rejected').length,
    cancelled: appRows.filter((a) => a.status === 'cancelled').length,
  };

  // ── CSV export ──
  if (format === 'csv') {
    const headers = [
      'Employee Code', 'Employee Name', 'Department', 'Leave Type',
      'From Date', 'To Date', 'Number of Days', 'Half Day',
      'Status', 'Reason', 'Applied At', 'Approved At',
    ];
    const csvRows = appRows.map((a) => [
      a.employeeCode, a.employeeName, a.department, a.leaveTypeName,
      a.fromDate, a.toDate, a.numberOfDays.toFixed(2), a.isHalfDay ? 'Yes' : 'No',
      a.status, a.reason ?? '', a.appliedAt, a.approvedAt ?? '',
    ]);
    const csv = [headers.join(','), ...csvRows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="leave_report_${year}_${month}.csv"` },
    });
  }

  return NextResponse.json({
    period: { year, month },
    statusSummary,
    byLeaveType: Array.from(byLeaveType.values()),
    applications: appRows,
    balances: balanceRows,
  });
}
