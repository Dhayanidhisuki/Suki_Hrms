/**
 * GET /api/workforce/permission/summary?year=YYYY&month=1-12
 *   Every employee's permission usage for a month against the company
 *   allowance: approved hours, hours still awaiting approval, what is left,
 *   and by how much anyone has gone over.
 *
 *   HR-level (workforce.permission.view) — this spans the whole company. An
 *   employee's own balance comes from GET /api/workforce/permission?scope=mine.
 *
 *   Employees with no requests that month are included with zeros, so the
 *   page reads as a roster rather than only showing people who happened to
 *   take short leave.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getFreeHoursPerMonth } from '@/lib/permissionPolicy';

/** Counted against the allowance: approved, plus anything still in flight. */
const COUNTED = ['pending_manager', 'pending_hr', 'approved'];

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.permission.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const now = new Date();
  const sp = request.nextUrl.searchParams;
  const year = Number(sp.get('year')) || now.getUTCFullYear();
  const month = Number(sp.get('month')) || now.getUTCMonth() + 1;
  if (month < 1 || month > 12) {
    return NextResponse.json({ error: 'month must be 1-12' }, { status: 400 });
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const [freeHoursPerMonth, employees, requests] = await Promise.all([
    getFreeHoursPerMonth(scope.companyId),
    prisma.employee.findMany({
      where: { companyId: scope.companyId, deletedAt: null, isActive: true },
      select: {
        id: true, employeeCode: true, firstName: true, lastName: true,
        jobInfos: { where: { effectiveTo: null }, take: 1, select: { department: { select: { name: true } } } },
      },
      orderBy: { employeeCode: 'asc' },
    }),
    prisma.permissionRequest.findMany({
      where: {
        employee: { companyId: scope.companyId, deletedAt: null },
        date: { gte: monthStart, lt: monthEnd },
        status: { in: COUNTED },
      },
      select: { employeeId: true, hours: true, status: true },
    }),
  ]);

  const approvedBy = new Map<number, number>();
  const pendingBy = new Map<number, number>();
  for (const r of requests) {
    const target = r.status === 'approved' ? approvedBy : pendingBy;
    target.set(r.employeeId, (target.get(r.employeeId) ?? 0) + Number(r.hours));
  }

  const rows = employees.map((e) => {
    const approvedHours = Number((approvedBy.get(e.id) ?? 0).toFixed(2));
    const pendingHours = Number((pendingBy.get(e.id) ?? 0).toFixed(2));
    const usedHours = Number((approvedHours + pendingHours).toFixed(2));
    return {
      // DataTable keys on `id`; kept alongside employeeId for clarity.
      id: e.id,
      employeeId: e.id,
      employeeCode: e.employeeCode,
      employeeName: `${e.firstName} ${e.lastName ?? ''}`.trim(),
      department: e.jobInfos[0]?.department?.name ?? null,
      approvedHours,
      pendingHours,
      usedHours,
      remainingHours: Number(Math.max(0, freeHoursPerMonth - usedHours).toFixed(2)),
      excessHours: Number(Math.max(0, usedHours - freeHoursPerMonth).toFixed(2)),
    };
  });

  return NextResponse.json({
    year,
    month,
    freeHoursPerMonth,
    data: rows,
    totals: {
      employees: rows.length,
      usingPermission: rows.filter((r) => r.usedHours > 0).length,
      overAllowance: rows.filter((r) => r.excessHours > 0).length,
      totalHours: Number(rows.reduce((s, r) => s + r.usedHours, 0).toFixed(2)),
    },
  });
}
