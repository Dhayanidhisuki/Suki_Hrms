/**
 * POST /api/workforce/permission/[id]/reject  { rejectionReason }
 *
 * Two-stage rejection (Manager → HR):
 *   - pending_manager: only the employee's own Reporting Manager may reject.
 *   - pending_hr: requires workforce.permission.approve.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { permissionRejectSchema } from '@/lib/validations/workforce';
import { resolveOwnEmployeeId, isManagerOfAnyLevel } from '@/lib/reportingManager';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = permissionRejectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const requestId = Number(id);
  const userId = Number(request.headers.get('x-user-id'));
  const record = await prisma.permissionRequest.findUnique({ where: { id: requestId } });
  if (!record || !(await findEmployeeInCompany(record.employeeId, scope.companyId))) {
    return NextResponse.json({ error: 'Permission request not found' }, { status: 404 });
  }

  // ── Stage 1: Manager rejection ──────────────────────────────────────────
  if (record.status === 'pending_manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId || !(await isManagerOfAnyLevel(ownEmployeeId, record.employeeId))) {
      return NextResponse.json(
        { error: "Forbidden — only the employee's Reporting Manager can reject this stage" },
        { status: 403 }
      );
    }
    const updated = await prisma.permissionRequest.update({
      where: { id: requestId },
      data: { status: 'rejected', managerRejectionReason: parsed.data.rejectionReason },
    });

    await notifyEssRequest({
      companyId: scope.companyId,
      kind: 'PERMISSION',
      action: 'REJECTED',
      employeeId: record.employeeId,
      requestId: requestId,
      period: formatPeriod(record.date),
      reason: parsed.data.rejectionReason,
      linkPath: '/ess/permission',
    });

    return NextResponse.json(updated);
  }

  // ── Stage 2: HR rejection ───────────────────────────────────────────────
  if (record.status === 'pending_hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.permission.approve');
    if (permErr) return permErr;

    const updated = await prisma.permissionRequest.update({
      where: { id: requestId },
      data: { status: 'rejected', rejectionReason: parsed.data.rejectionReason },
    });

    await notifyEssRequest({
      companyId: scope.companyId,
      kind: 'PERMISSION',
      action: 'REJECTED',
      employeeId: record.employeeId,
      requestId: requestId,
      period: formatPeriod(record.date),
      reason: parsed.data.rejectionReason,
      linkPath: '/ess/permission',
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json(
    { error: `Request is already ${record.status} — nothing to reject` },
    { status: 409 }
  );
}
