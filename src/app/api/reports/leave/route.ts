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
