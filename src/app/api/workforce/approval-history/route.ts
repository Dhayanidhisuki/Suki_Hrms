/**
 * GET /api/workforce/approval-history
 *   One consolidated audit trail of every employee request that goes through
 *   the two-stage Manager → HR chain, across all modules, with both stages'
 *   actor and timestamp on each row.
 *
 *   Query: module=leave|mispunch|permission|on-duty|wfh (repeatable, default
 *   all) · status=... · employeeId=... · from=YYYY-MM-DD · to=YYYY-MM-DD
 *   (on appliedAt) · limit (default 200, max 1000).
 *
 *   HR-level: gated on workforce.leave.view, the same grant the HR-side
 *   queues require. This deliberately spans every employee, so it is NOT a
 *   self-service surface — an employee sees their own trail on each ESS page.
 *
 *   The union is built in application code rather than SQL because the five
 *   models are near-identical but not identical: mispunch names its second
 *   stage hrAction*, the others approvedBy/approvedAt, and each carries a
 *   different descriptive field. Normalising here keeps one shape for the UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { checkSpecificPermission } from '@/lib/rbac-employee';

export type ApprovalModule = 'leave' | 'mispunch' | 'permission' | 'on-duty' | 'wfh';
const ALL_MODULES: ApprovalModule[] = ['leave', 'mispunch', 'permission', 'on-duty', 'wfh'];

const MODULE_LABEL: Record<ApprovalModule, string> = {
  leave: 'Leave',
  mispunch: 'Mis-Punch',
  permission: 'Permission',
  'on-duty': 'On-Duty',
  wfh: 'WFH',
};

interface HistoryRow {
  module: ApprovalModule;
  moduleLabel: string;
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  detail: string;
  period: string;
  reason: string | null;
  status: string;
  appliedAt: Date;
  managerActionByUserId: number | null;
  managerActionAt: Date | null;
  managerRejectionReason: string | null;
  hrActionByUserId: number | null;
  hrActionAt: Date | null;
  hrRejectionReason: string | null;
}

const d = (x: Date | null | undefined) => (x ? new Date(x).toISOString().slice(0, 10) : '—');
const empOf = (e: { id: number; employeeCode: string; firstName: string; lastName: string | null }) => ({
  employeeId: e.id,
  employeeCode: e.employeeCode,
  employeeName: `${e.firstName} ${e.lastName ?? ''}`.trim(),
});

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.leave.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const sp = request.nextUrl.searchParams;
  const requested = sp.getAll('module').filter((m): m is ApprovalModule => ALL_MODULES.includes(m as ApprovalModule));
  const modules = requested.length > 0 ? requested : ALL_MODULES;
  const status = sp.get('status');
  const employeeId = Number(sp.get('employeeId')) || null;
  const from = sp.get('from');
  const to = sp.get('to');
  const limit = Math.min(Number(sp.get('limit')) || 200, 1000);

  const appliedAt =
    from || to
      ? { ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}) }
      : undefined;

  const where = {
    employee: { companyId: scope.companyId, deletedAt: null },
    ...(status ? { status } : {}),
    ...(employeeId ? { employeeId } : {}),
    ...(appliedAt ? { appliedAt } : {}),
  };
  const employee = { select: { id: true, employeeCode: true, firstName: true, lastName: true } };
  const take = limit;
  const orderBy = { appliedAt: 'desc' } as const;

  const rows: HistoryRow[] = [];

  if (modules.includes('leave')) {
    const recs = await prisma.leaveApplication.findMany({
      where, take, orderBy,
      include: { employee, leaveMaster: { select: { name: true } } },
    });
    for (const r of recs) {
      rows.push({
        module: 'leave', moduleLabel: MODULE_LABEL.leave, id: r.id, ...empOf(r.employee),
        detail: `${r.leaveMaster?.name ?? 'Leave'} · ${Number(r.numberOfDays).toFixed(1)} day(s)`,
        period: `${d(r.fromDate)} → ${d(r.toDate)}`,
        reason: r.reason, status: r.status, appliedAt: r.appliedAt,
        managerActionByUserId: r.managerActionByUserId, managerActionAt: r.managerActionAt,
        managerRejectionReason: r.managerRejectionReason,
        hrActionByUserId: r.approvedByUserId, hrActionAt: r.approvedAt,
        hrRejectionReason: r.rejectionReason,
      });
    }
  }

  if (modules.includes('mispunch')) {
    const recs = await prisma.mispunchCorrection.findMany({ where, take, orderBy, include: { employee } });
    for (const r of recs) {
      rows.push({
        module: 'mispunch', moduleLabel: MODULE_LABEL.mispunch, id: r.id, ...empOf(r.employee),
        detail: `In ${r.requestedInTime ? new Date(r.requestedInTime).toISOString().slice(11, 16) : '—'} · Out ${r.requestedOutTime ? new Date(r.requestedOutTime).toISOString().slice(11, 16) : '—'}`,
        period: d(r.date),
        reason: r.reason, status: r.status, appliedAt: r.appliedAt,
        managerActionByUserId: r.managerActionByUserId, managerActionAt: r.managerActionAt,
        managerRejectionReason: r.managerRejectionReason,
        // Mispunch is the one model that names its second stage hrAction*.
        hrActionByUserId: r.hrActionByUserId, hrActionAt: r.hrActionAt,
        hrRejectionReason: r.hrRejectionReason,
      });
    }
  }

  if (modules.includes('permission')) {
    const recs = await prisma.permissionRequest.findMany({ where, take, orderBy, include: { employee } });
    for (const r of recs) {
      rows.push({
        module: 'permission', moduleLabel: MODULE_LABEL.permission, id: r.id, ...empOf(r.employee),
        detail: `${Number(r.hours).toFixed(2)} hour(s)`,
        period: d(r.date),
        reason: r.reason, status: r.status, appliedAt: r.appliedAt,
        managerActionByUserId: r.managerActionByUserId, managerActionAt: r.managerActionAt,
        managerRejectionReason: r.managerRejectionReason,
        hrActionByUserId: r.approvedByUserId, hrActionAt: r.approvedAt,
        hrRejectionReason: r.rejectionReason,
      });
    }
  }

  if (modules.includes('on-duty')) {
    const recs = await prisma.onDutyRequest.findMany({ where, take, orderBy, include: { employee } });
    for (const r of recs) {
      rows.push({
        module: 'on-duty', moduleLabel: MODULE_LABEL['on-duty'], id: r.id, ...empOf(r.employee),
        detail: `${r.location} · ${r.purpose}`,
        period: `${d(r.fromDate)} → ${d(r.toDate)}`,
        // On-Duty carries remarks rather than a reason field.
        reason: r.remarks, status: r.status, appliedAt: r.appliedAt,
        managerActionByUserId: r.managerActionByUserId, managerActionAt: r.managerActionAt,
        managerRejectionReason: r.managerRejectionReason,
        hrActionByUserId: r.approvedByUserId, hrActionAt: r.approvedAt,
        hrRejectionReason: r.rejectionReason,
      });
    }
  }

  if (modules.includes('wfh')) {
    const recs = await prisma.wfhRequest.findMany({ where, take, orderBy, include: { employee } });
    for (const r of recs) {
      rows.push({
        module: 'wfh', moduleLabel: MODULE_LABEL.wfh, id: r.id, ...empOf(r.employee),
        detail: 'Work from home',
        period: `${d(r.fromDate)} → ${d(r.toDate)}`,
        reason: r.reason, status: r.status, appliedAt: r.appliedAt,
        managerActionByUserId: r.managerActionByUserId, managerActionAt: r.managerActionAt,
        managerRejectionReason: r.managerRejectionReason,
        hrActionByUserId: r.approvedByUserId, hrActionAt: r.approvedAt,
        hrRejectionReason: r.rejectionReason,
      });
    }
  }

  // Each module was taken separately, so sort and trim the merged set — the
  // newest 200 overall, not the newest 200 of each.
  rows.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
  const page = rows.slice(0, limit);

  // Resolve every actor in one query rather than per row.
  const userIds = [...new Set(page.flatMap((r) => [r.managerActionByUserId, r.hrActionByUserId]).filter((x): x is number => x != null))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
    : [];
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  const empByUserId = new Map(
    (await prisma.employee.findMany({
      where: { userId: { in: userIds.length ? userIds : [-1] }, deletedAt: null },
      select: { userId: true, employeeCode: true, firstName: true, lastName: true },
    })).map((e) => [e.userId!, `${e.employeeCode} — ${e.firstName} ${e.lastName ?? ''}`.trim()])
  );
  const actor = (id: number | null) => (id == null ? null : empByUserId.get(id) ?? emailById.get(id) ?? `User #${id}`);

  return NextResponse.json({
    data: page.map((r) => ({
      ...r,
      managerActionBy: actor(r.managerActionByUserId),
      hrActionBy: actor(r.hrActionByUserId),
    })),
    total: rows.length,
    truncated: rows.length > limit,
    modules,
  });
}
