/**
 * POST /api/workforce/permission/[id]/approve
 *
 * Single-stage RBAC approval (workforce.permission.approve) — no
 * Reporting-Manager stage, per the BRD's Permission section. Approving
 * sums this employee's other already-approved permission hours in the
 * same calendar month, adds this request's hours, and compares the total
 * against the company's PermissionPolicy.freeHoursPerMonth (defaulting to
 * 2h if the company has never set one). If the total exceeds the
 * allowance, the request is flagged (exceedsAllowance/excessHours) for HR
 * to action as a manual LOP correction — see the PermissionRequest model
 * comment in schema.prisma for why this doesn't auto-touch DailyAttendance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'workforce.permission.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const requestId = Number(id);
  const record = await prisma.permissionRequest.findUnique({ where: { id: requestId } });
  if (!record) {
    return NextResponse.json({ error: 'Permission request not found' }, { status: 404 });
  }
  if (!(await findEmployeeInCompany(record.employeeId, scope.companyId))) {
    return NextResponse.json({ error: 'Permission request not found' }, { status: 404 });
  }
  if (record.status !== 'pending') {
    return NextResponse.json({ error: `Request is already ${record.status} — nothing to approve` }, { status: 409 });
  }

  const monthStart = new Date(Date.UTC(record.date.getUTCFullYear(), record.date.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(record.date.getUTCFullYear(), record.date.getUTCMonth() + 1, 1));

  const otherApprovedThisMonth = await prisma.permissionRequest.findMany({
    where: { employeeId: record.employeeId, status: 'approved', date: { gte: monthStart, lt: monthEnd } },
    select: { hours: true },
  });
  const priorHours = otherApprovedThisMonth.reduce((sum, r) => sum + Number(r.hours), 0);
  const totalHours = priorHours + Number(record.hours);

  const policy = await prisma.permissionPolicy.findUnique({ where: { companyId: scope.companyId } });
  const freeHoursPerMonth = policy ? Number(policy.freeHoursPerMonth) : 2;

  const exceedsAllowance = totalHours > freeHoursPerMonth;
  const excessHours = exceedsAllowance ? Math.round((totalHours - freeHoursPerMonth) * 100) / 100 : 0;

  const userId = Number(request.headers.get('x-user-id')) || null;
  const updated = await prisma.permissionRequest.update({
    where: { id: requestId },
    data: { status: 'approved', approvedByUserId: userId, approvedAt: new Date(), exceedsAllowance, excessHours },
  });

  return NextResponse.json(updated);
}
