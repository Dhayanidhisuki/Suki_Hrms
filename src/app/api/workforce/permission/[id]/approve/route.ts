/**
 * POST /api/workforce/permission/[id]/approve
 *
 * Two-stage approval (Manager → HR):
 *   Stage 1 (pending_manager): only the employee's own Reporting Manager
 *     (Level 1 or Level 2) may act. Advances to pending_hr.
 *   Stage 2 (pending_hr): requires workforce.permission.approve. Sums this
 *     employee's other already-approved permission hours in the same
 *     calendar month, adds this request's hours, and compares the total
 *     against the company's PermissionPolicy.freeHoursPerMonth (defaulting
 *     to 2h if the company has never set one). If the total exceeds the
 *     allowance, the request is flagged (exceedsAllowance/excessHours) for
 *     HR to action as a manual LOP correction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { resolveOwnEmployeeId, isManagerOfAnyLevel } from '@/lib/reportingManager';
import { getFreeHoursPerMonth } from '@/lib/permissionPolicy';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const requestId = Number(id);
  const userId = Number(request.headers.get('x-user-id'));

  const record = await prisma.permissionRequest.findUnique({ where: { id: requestId } });
  if (!record) {
    return NextResponse.json({ error: 'Permission request not found' }, { status: 404 });
  }
  if (!(await findEmployeeInCompany(record.employeeId, scope.companyId))) {
    return NextResponse.json({ error: 'Permission request not found' }, { status: 404 });
  }

  // ── Stage 1: Manager approval ──────────────────────────────────────────
  if (record.status === 'pending_manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId || !(await isManagerOfAnyLevel(ownEmployeeId, record.employeeId))) {
      return NextResponse.json(
        { error: "Forbidden — only the employee's Reporting Manager can approve this stage" },
        { status: 403 }
      );
    }
    const updated = await prisma.permissionRequest.update({
      where: { id: requestId },
      data: {
        status: 'pending_hr',
        managerActionByUserId: userId,
        managerActionAt: new Date(),
      },
    });
    return NextResponse.json({ message: 'Approved by manager, forwarded to HR', data: updated });
  }

  // ── Stage 2: HR approval ───────────────────────────────────────────────
  if (record.status === 'pending_hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.permission.approve');
    if (permErr) return permErr;

    const monthStart = new Date(Date.UTC(record.date.getUTCFullYear(), record.date.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(record.date.getUTCFullYear(), record.date.getUTCMonth() + 1, 1));

    const otherApprovedThisMonth = await prisma.permissionRequest.findMany({
      where: { employeeId: record.employeeId, status: 'approved', date: { gte: monthStart, lt: monthEnd } },
      select: { hours: true },
    });
    const priorHours = otherApprovedThisMonth.reduce((sum, r) => sum + Number(r.hours), 0);
    const totalHours = priorHours + Number(record.hours);

    const freeHoursPerMonth = await getFreeHoursPerMonth(scope.companyId);

    const exceedsAllowance = totalHours > freeHoursPerMonth;
    const excessHours = exceedsAllowance ? Math.round((totalHours - freeHoursPerMonth) * 100) / 100 : 0;

    const updated = await prisma.permissionRequest.update({
      where: { id: requestId },
      data: { status: 'approved', approvedByUserId: userId, approvedAt: new Date(), exceedsAllowance, excessHours },
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json(
    { error: `Request is already ${record.status} — nothing to approve` },
    { status: 409 }
  );
}
