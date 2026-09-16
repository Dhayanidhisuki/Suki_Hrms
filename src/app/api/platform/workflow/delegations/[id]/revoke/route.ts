/**
 * POST /api/platform/workflow/delegations/[id]/revoke — immediate revocation (§8.3 rule 10).
 * Delegator, or platform.workflow.admin. Body: { reason? }. Actions already taken stay valid.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';
import { errorResponse, isWorkflowAdmin, parseId, readJson, resolveActor } from '@/lib/platform/workflow/http';
import { wfCancelSchema } from '@/lib/validations/platform-workflow';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.act');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = wfCancelSchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  try {
    const actor = await resolveActor(request);
    const row = await prisma.workflowDelegation.findFirst({ where: { id, companyId: scope.companyId } });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (row.delegatorEmpId !== actor.employeeId && !(await isWorkflowAdmin(request))) {
      return NextResponse.json({ error: 'Only the delegator or a workflow administrator may revoke' }, { status: 403 });
    }
    if (!['Active', 'Pending'].includes(row.status)) return NextResponse.json({ error: `Delegation is ${row.status}` }, { status: 409 });

    const { count } = await prisma.workflowDelegation.updateMany({
      where: { id, status: { in: ['Active', 'Pending'] } },
      data: { status: 'Revoked', revokedAt: new Date(), revokedByUserId: actor.userId },
    });
    if (count === 0) return NextResponse.json({ error: 'Delegation was changed concurrently' }, { status: 409 });
    const updated = await prisma.workflowDelegation.findUnique({ where: { id } });
    await audit({ companyId: scope.companyId, entityType: 'WorkflowDelegation', entityId: id, entityRef: `DEL/${id}`, action: 'DELEGATE_REVOKE', actor, before: row, after: updated, remark: parsed.data.reason ?? null });
    return NextResponse.json(updated);
  } catch (err) {
    return errorResponse(err);
  }
}
