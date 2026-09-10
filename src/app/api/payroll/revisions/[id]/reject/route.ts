/**
 * POST /api/payroll/revisions/[id]/reject
 *
 * Two-stage rejection (Manager → HR):
 *   - PENDING_MANAGER: only the employee's own Reporting Manager may reject.
 *     Stores managerRejectReason.
 *   - PENDING_HR: requires payroll.revision.approve. Stores rejectReason.
 * Employee Master/Payroll are untouched (BR-10).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { rejectRevisionSchema } from '@/lib/validations/payroll';
import { resolveOwnEmployeeId, isManagerOfAnyLevel } from '@/lib/reportingManager';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const userId = Number(request.headers.get('x-user-id')) || null;

  const parsed = rejectRevisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.salaryRevisionRequest.findFirst({ where: { id: Number(id), companyId: scope.companyId } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // ── Stage 1: Manager rejection ──────────────────────────────────────────
  if (record.status === 'PENDING_MANAGER') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId ?? 0);
    if (!ownEmployeeId || !(await isManagerOfAnyLevel(ownEmployeeId, record.employeeId))) {
      return NextResponse.json(
        { error: "Forbidden — only the employee's Reporting Manager can reject this stage" },
        { status: 403 }
      );
    }
    const updated = await prisma.salaryRevisionRequest.update({
      where: { id: record.id },
      data: { status: 'REJECTED', managerRejectReason: parsed.data.rejectReason },
    });
    return NextResponse.json(updated);
  }

  // ── Stage 2: HR rejection ───────────────────────────────────────────────
  if (record.status === 'PENDING_HR') {
    const permErr = await checkSpecificPermission(request, 'payroll.revision.approve');
    if (permErr) return permErr;

    const updated = await prisma.salaryRevisionRequest.update({
      where: { id: record.id },
      data: { status: 'REJECTED', rejectReason: parsed.data.rejectReason },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json(
    { error: `Cannot reject a revision in ${record.status} status.` },
    { status: 409 }
  );
}
