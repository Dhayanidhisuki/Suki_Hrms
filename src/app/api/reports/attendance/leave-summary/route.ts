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
import { generateReportTablePdf } from '@/lib/reportTablePdf';

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
  if (format === 'pdf') {
    const company = await prisma.company.findUnique({ where: { id: scope.companyId }, select: { name: true } });
    const pdfBytes = await generateReportTablePdf({
      title: `${company?.name ?? 'Company'} — Leave Report`,
      subtitle: `For the month of ${MONTH_NAMES[month]} ${year}`,
      columns: [
        { label: 'Sl No', width: 30, value: (_r, i) => String(i + 1) },
        { label: 'Emp Code', width: 58, value: (r) => r.employeeCode },
        { label: 'Employee Name', width: 118, value: (r) => r.employeeName },
        { label: 'Department', width: 95, value: (r) => r.department },
        { label: 'Leave Type', width: 95, value: (r) => r.leaveTypeName },
        { label: 'From', width: 60, value: (r) => r.fromDate },
        { label: 'To', width: 60, value: (r) => r.toDate },
        { label: 'Days', width: 38, align: 'right', value: (r) => r.numberOfDays.toFixed(2) },
        { label: 'Half Day', width: 44, value: (r) => (r.isHalfDay ? 'Yes' : 'No') },
        { label: 'Status', width: 70, value: (r) => r.status },
        { label: 'Reason', width: 110, value: (r) => r.reason ?? '' },
        { label: 'Applied At', width: 62, value: (r) => r.appliedAt },
      ],
      rows: appRows,
      footer: [
        { label: 'Applications', value: String(appRows.length) },
        { label: 'Total Days', value: appRows.reduce((s, a) => s + a.numberOfDays, 0).toFixed(2) },
      ],
      emptyMessage: 'No leave applications for this period.',
    });
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="leave_report_${year}_${String(month).padStart(2, '0')}.pdf"`,
      },
    });
  }

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
