/**
 * GET /api/workforce/attendance/regularization-summary?year=YYYY&month=M
 *
 * Returns a summary of all attendance regularization requests (mispunch,
 * permission, OT) for a month — counts by status and type, plus a
 * per-employee breakdown. Used by the regularization summary page.
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
  const year = parseInt(searchParams.get('year') ?? String(new Date().getUTCFullYear()));
  const month = parseInt(searchParams.get('month') ?? String(new Date().getUTCMonth() + 1));

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  // Load all regularization requests in parallel.
  const [mispunches, permissions, otApprovals] = await Promise.all([
    prisma.mispunchCorrection.findMany({
      where: {
        date: { gte: monthStart, lt: monthEnd },
        employee: { companyId: scope.companyId, deletedAt: null },
      },
      include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
    }),
    prisma.permissionRequest.findMany({
      where: {
        date: { gte: monthStart, lt: monthEnd },
        employee: { companyId: scope.companyId, deletedAt: null },
      },
      include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
    }),
    prisma.dailyAttendance.findMany({
      where: {
        date: { gte: monthStart, lt: monthEnd },
        employee: { companyId: scope.companyId, deletedAt: null },
        otApprovalStatus: { in: ['pending_manager', 'pending_hr', 'approved', 'rejected'] },
      },
      include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
    }),
  ]);

  // Count by type and status.
  const counts = {
    mispunch: {
      pending_manager: mispunches.filter((m) => m.status === 'pending_manager').length,
      pending_hr: mispunches.filter((m) => m.status === 'pending_hr').length,
      approved: mispunches.filter((m) => m.status === 'approved').length,
      rejected: mispunches.filter((m) => m.status === 'rejected').length,
    },
    permission: {
      pending_manager: permissions.filter((p) => p.status === 'pending_manager').length,
      pending_hr: permissions.filter((p) => p.status === 'pending_hr').length,
      approved: permissions.filter((p) => p.status === 'approved').length,
      rejected: permissions.filter((p) => p.status === 'rejected').length,
      excess: permissions.filter((p) => p.status === 'approved' && p.exceedsAllowance).length,
    },
    ot: {
      pending_manager: otApprovals.filter((o) => o.otApprovalStatus === 'pending_manager').length,
      pending_hr: otApprovals.filter((o) => o.otApprovalStatus === 'pending_hr').length,
      approved: otApprovals.filter((o) => o.otApprovalStatus === 'approved').length,
      rejected: otApprovals.filter((o) => o.otApprovalStatus === 'rejected').length,
      comp_off: otApprovals.filter((o) => o.otApprovalStatus === 'approved' && o.otSettlementType === 'COMP_OFF').length,
    },
  };

  // Per-employee breakdown.
  const employeeMap = new Map<number, {
    employeeCode: string;
    name: string;
    mispunch: { pending: number; approved: number; rejected: number };
    permission: { pending: number; approved: number; rejected: number; excessHours: number };
    ot: { pending: number; approved: number; rejected: number; otMinutes: number };
  }>();

  const getOrCreate = (emp: { id: number; employeeCode: string; firstName: string; lastName: string }) => {
    let entry = employeeMap.get(emp.id);
    if (!entry) {
      entry = {
        employeeCode: emp.employeeCode,
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        mispunch: { pending: 0, approved: 0, rejected: 0 },
        permission: { pending: 0, approved: 0, rejected: 0, excessHours: 0 },
        ot: { pending: 0, approved: 0, rejected: 0, otMinutes: 0 },
      };
      employeeMap.set(emp.id, entry);
    }
    return entry;
  };

  for (const m of mispunches) {
    const entry = getOrCreate(m.employee);
    if (m.status === 'pending_manager' || m.status === 'pending_hr') entry.mispunch.pending++;
    else if (m.status === 'approved') entry.mispunch.approved++;
    else if (m.status === 'rejected') entry.mispunch.rejected++;
  }

  for (const p of permissions) {
    const entry = getOrCreate(p.employee);
    if (p.status === 'pending_manager' || p.status === 'pending_hr') entry.permission.pending++;
    else if (p.status === 'approved') {
      entry.permission.approved++;
      entry.permission.excessHours += Number(p.excessHours);
    }
    else if (p.status === 'rejected') entry.permission.rejected++;
  }

  for (const o of otApprovals) {
    const entry = getOrCreate(o.employee);
    if (o.otApprovalStatus === 'pending_manager' || o.otApprovalStatus === 'pending_hr') entry.ot.pending++;
    else if (o.otApprovalStatus === 'approved') {
      entry.ot.approved++;
      entry.ot.otMinutes += o.otMinutesApproved ?? o.otMinutesCalculated ?? 0;
    }
    else if (o.otApprovalStatus === 'rejected') entry.ot.rejected++;
  }

  return NextResponse.json({
    period: { year, month },
    counts,
    employees: Array.from(employeeMap.entries()).map(([id, data]) => ({ employeeId: id, ...data })),
  });
}
