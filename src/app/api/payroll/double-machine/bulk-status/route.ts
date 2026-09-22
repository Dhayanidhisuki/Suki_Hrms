/**
 * POST /api/payroll/double-machine/bulk-status
 * Body: { ids: number[], action: 'approve' | 'hold' | 'return', reason?: string }
 *
 * Applies one transition to many rows in a single transaction. The page used
 * to do this by firing one request per selected row, so a partial failure left
 * the selection half-applied with no way to tell which half. Here it is all or
 * nothing, and rows whose current status does not permit the verb are reported
 * back rather than silently skipped.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { logActivity } from '@/lib/activity-log';
import { planTransition, type DmVerb } from '@/lib/payroll/doubleMachineWorkflow';
import { checkPeriodEditable } from '@/lib/payrollGuard';

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.dm.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids)
    ? body.ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
    : [];
  const action = body?.action as DmVerb;
  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 500) : null;
  if (ids.length === 0) return NextResponse.json({ error: 'ids are required' }, { status: 400 });

  const rows = await prisma.doubleMachineIncentive.findMany({
    where: { id: { in: ids }, companyId: scope.companyId },
  });
  if (rows.length === 0) return NextResponse.json({ error: 'No matching records' }, { status: 404 });

  // Every period touched must still be open.
  for (const key of new Set(rows.map((r) => `${r.year}-${r.month}`))) {
    const [y, m] = key.split('-').map(Number);
    const lockErr = await checkPeriodEditable(scope.companyId, y, m);
    if (lockErr) return lockErr;
  }

  // Validate the whole selection before writing any of it.
  const rejected: { id: number; reason: string }[] = [];
  const planned: { row: (typeof rows)[number]; to: string; activity: string }[] = [];
  for (const row of rows) {
    const plan = planTransition(action, row.status);
    if ('error' in plan) rejected.push({ id: row.id, reason: plan.error });
    else planned.push({ row, to: plan.to, activity: plan.activity });
  }
  if (rejected.length > 0) {
    return NextResponse.json(
      { error: `${rejected.length} of ${rows.length} selected rows cannot be ${action}d`, rejected },
      { status: 409 }
    );
  }

  const userId = Number(request.headers.get('x-user-id')) || null;
  await prisma.$transaction(async (tx) => {
    for (const { row, to, activity } of planned) {
      await tx.doubleMachineIncentive.update({
        where: { id: row.id },
        data: {
          status: to,
          updatedByUserId: userId,
          approvedByUserId: to === 'complete' ? userId : null,
          approvedAt: to === 'complete' ? new Date() : null,
          rejectionReason: to === 'complete' ? null : reason,
        },
      });
      await logActivity(tx, {
        employeeId: row.employeeId,
        activityType: activity,
        module: 'double-machine',
        performedByUserId: userId,
        oldValue: { status: row.status },
        newValue: { status: to, reason },
        relatedRecordId: row.id,
      });
    }
  });

  return NextResponse.json({ updated: planned.length, action });
}
