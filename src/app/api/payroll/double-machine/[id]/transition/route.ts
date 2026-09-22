/**
 * POST /api/payroll/double-machine/[id]/transition — move one row between
 * statuses. Body: { action: 'approve' | 'hold' | 'return', reason?: string }
 *
 * One route for all three verbs rather than three near-identical files: the
 * only thing that differs is the legal source set, which lives in
 * src/lib/payroll/doubleMachineWorkflow.ts. Gated on `payroll.dm.approve`,
 * separate from `payroll.processing.edit` — keying an amount and signing it
 * off for payment are different authorities now that `complete` is paid.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { logActivity } from '@/lib/activity-log';
import { planTransition, type DmVerb } from '@/lib/payroll/doubleMachineWorkflow';
import { checkPeriodEditable } from '@/lib/payrollGuard';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.dm.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body?.action as DmVerb;
  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 500) : null;

  const record = await prisma.doubleMachineIncentive.findUnique({ where: { id: Number(id) } });
  if (!record || record.companyId !== scope.companyId
      || !(await findEmployeeInCompany(record.employeeId, scope.companyId))) {
    return NextResponse.json({ error: 'Incentive record not found' }, { status: 404 });
  }

  // A row behind an approved/locked payroll run must not move — the payslip
  // for that period is already out.
  const lockErr = await checkPeriodEditable(scope.companyId, record.year, record.month);
  if (lockErr) return lockErr;

  const plan = planTransition(action, record.status);
  if ('error' in plan) return NextResponse.json({ error: plan.error }, { status: 409 });

  const userId = Number(request.headers.get('x-user-id')) || null;
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.doubleMachineIncentive.update({
      where: { id: record.id },
      data: {
        status: plan.to,
        updatedByUserId: userId,
        approvedByUserId: plan.to === 'complete' ? userId : null,
        approvedAt: plan.to === 'complete' ? new Date() : null,
        rejectionReason: plan.to === 'complete' ? null : reason,
      },
    });
    await logActivity(tx, {
      employeeId: record.employeeId,
      activityType: plan.activity,
      module: 'double-machine',
      performedByUserId: userId,
      oldValue: { status: record.status },
      newValue: { status: plan.to, reason },
      relatedRecordId: record.id,
    });
    return saved;
  });
  return NextResponse.json(updated);
}
