/**
 * GET /api/reports/leave?year=X&month=Y
 *
 * Leave report — leave applications, balances, and utilization by
 * leave type. Supports CSV export via ?format=csv.
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

  // Leave applications in this month.
  const applications = await prisma.leaveApplication.findMany({
    where: {
      fromDate: { lt: monthEnd },
      toDate: { gte: monthStart },
      employee: { companyId: scope.companyId, deletedAt: null },
    },
    include: {
      employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      leaveMaster: { select: { code: true, name: true } },
    },
  });

  // Leave balances.
  const balances = await prisma.leaveBalance.findMany({
    where: { employee: { companyId: scope.companyId, deletedAt: null } },
    include: {
      employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      leaveMaster: { select: { code: true, name: true } },
    },
  });

  // Aggregate by leave type.
  const byType = new Map<string, { count: number; days: number }>();
  for (const app of applications) {
    if (app.status !== 'approved') continue;
    const leaveType = app.leaveMaster?.name ?? 'Unknown';
    const days = Math.ceil((new Date(app.toDate).getTime() - new Date(app.fromDate).getTime()) / 86400000) + 1;
    const existing = byType.get(leaveType) ?? { count: 0, days: 0 };
    existing.count++;
    existing.days += days;
    byType.set(leaveType, existing);
  }

  const report = {
    period: { year, month },
    totalApplications: applications.length,
    approved: applications.filter((a) => a.status === 'approved').length,
    pending: applications.filter((a) => a.status === 'pending_manager' || a.status === 'pending_hr').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
    byLeaveType: Array.from(byType.entries()).map(([type, data]) => ({ leaveType: type, ...data })),
    balances: balances.map((b) => ({
      employeeCode: b.employee.employeeCode,
      name: `${b.employee.firstName} ${b.employee.lastName}`.trim(),
      leaveType: b.leaveMaster?.name ?? 'Unknown',
      opening: Number(b.openingBalance),
      accrued: Number(b.accrued),
      availed: Number(b.availed),
      closing: Number(b.closingBalance),
    })),
  };

  if (format === 'pdf') {
    const company = await prisma.company.findUnique({ where: { id: scope.companyId }, select: { name: true } });
    const pdfBytes = await generateReportTablePdf({
      title: `${company?.name ?? 'Company'} — Leave Summary Report`,
      subtitle: `For the month of ${MONTH_NAMES[month]} ${year}`,
      columns: [
        { label: 'Sl No', width: 32, value: (_r, i) => String(i + 1) },
        { label: 'Emp Code', width: 60, value: (r) => r.employeeCode },
        { label: 'Employee Name', width: 130, value: (r) => r.name },
        { label: 'Leave Type', width: 110, value: (r) => r.leaveType },
        { label: 'Opening', width: 55, align: 'right', value: (r) => r.opening.toFixed(2) },
        { label: 'Accrued', width: 55, align: 'right', value: (r) => r.accrued.toFixed(2) },
        { label: 'Availed', width: 55, align: 'right', value: (r) => r.availed.toFixed(2) },
        { label: 'Closing', width: 55, align: 'right', value: (r) => r.closing.toFixed(2) },
      ],
      rows: report.balances,
      footer: [
        { label: 'Balance Rows', value: String(report.balances.length) },
        { label: 'Applications', value: String(report.totalApplications) },
        { label: 'Approved', value: String(report.approved) },
        { label: 'Pending', value: String(report.pending) },
      ],
      emptyMessage: 'No leave balances for this period.',
    });
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="leave_${year}_${String(month).padStart(2, '0')}.pdf"`,
      },
    });
  }

  if (format === 'csv') {
    const headers = ['Code', 'Name', 'Leave Type', 'Opening', 'Accrued', 'Availed', 'Closing'];
    const rows = report.balances.map((b) => [
      b.employeeCode, `"${b.name}"`, `"${b.leaveType}"`,
      String(b.opening), String(b.accrued), String(b.availed), String(b.closing),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="leave_${year}_${month}.csv"` },
    });
  }

  return NextResponse.json(report);
}
