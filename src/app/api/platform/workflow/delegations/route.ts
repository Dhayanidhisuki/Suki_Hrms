/**
 * GET  /api/platform/workflow/delegations — list (platform.workflow.view): own (as delegator or delegate) unless admin.
 * POST /api/platform/workflow/delegations — create (platform.workflow.act). §8.3 rules 2 (self), 3 (chain depth 1),
 *      4 (overlap) enforced at save; §8.4: to a direct report, scope ALL, ≤ 15 days → Active immediately; anything
 *      else → Pending (BRD §8.2; the column is NVarChar(10)). Creating on behalf of another delegator requires platform.workflow.admin.
 */

import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';
import { emitPlatformEvent } from '@/lib/platform/events';
import { errorResponse, isWorkflowAdmin, queryObject, readJson, resolveActor } from '@/lib/platform/workflow/http';
import { wfDelegationListQuerySchema, wfDelegationSchema } from '@/lib/validations/platform-workflow';

const DAY_MS = 24 * 60 * 60 * 1000;
const NO_APPROVAL_MAX_DAYS = 15;

function isoToUtcDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function refSet(list: string | null | undefined): Set<string> {
  return new Set((list ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
}

/** Rule 4: same delegator, overlapping dates, overlapping scope. */
function scopesOverlap(a: { scopeType: string; scopeRefList: string | null }, b: { scopeType: string; scopeRefList: string | null }): boolean {
  if (a.scopeType === 'ALL' || b.scopeType === 'ALL') return true;
  if (a.scopeType !== b.scopeType) return false;
  const x = refSet(a.scopeRefList);
  for (const r of refSet(b.scopeRefList)) if (x.has(r)) return true;
  return false;
}

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = wfDelegationListQuerySchema.safeParse(queryObject(request));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const q = parsed.data;
  try {
    const actor = await resolveActor(request);
    const admin = await isWorkflowAdmin(request);
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const where: Prisma.WorkflowDelegationWhereInput = {
      companyId: scope.companyId,
      ...(q.status ? { status: q.status } : {}),
      ...(q.delegatorEmpId ? { delegatorEmpId: q.delegatorEmpId } : {}),
      ...(q.delegateEmpId ? { delegateEmpId: q.delegateEmpId } : {}),
    };
    if (!admin) {
      if (actor.employeeId == null) return NextResponse.json({ data: [], total: 0 });
      where.OR = [{ delegatorEmpId: actor.employeeId }, { delegateEmpId: actor.employeeId }];
    }
    const [total, data] = await Promise.all([
      prisma.workflowDelegation.count({ where }),
      prisma.workflowDelegation.findMany({ where, orderBy: [{ fromDate: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
    ]);
    return NextResponse.json({ data, total });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.act');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = wfDelegationSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  try {
    const actor = await resolveActor(request);
    const admin = await isWorkflowAdmin(request);
    const delegatorEmpId = b.delegatorEmpId ?? actor.employeeId ?? null;
    if (!delegatorEmpId) return NextResponse.json({ error: 'Your user is not linked to an employee; pass delegatorEmpId' }, { status: 400 });
    const onBehalf = delegatorEmpId !== actor.employeeId;
    if (onBehalf && !admin) return NextResponse.json({ error: 'Creating a delegation for another employee requires platform.workflow.admin' }, { status: 403 });

    // Rule 2: self-delegation.
    if (delegatorEmpId === b.delegateEmpId) return NextResponse.json({ error: 'Self-delegation is not permitted', code: 'WF-DELEG-SELF-400' }, { status: 400 });

    const [delegator, delegate] = await Promise.all([
      prisma.employee.findFirst({ where: { id: delegatorEmpId, companyId: scope.companyId, deletedAt: null }, select: { id: true, reportingManagerId: true } }),
      prisma.employee.findFirst({ where: { id: b.delegateEmpId, companyId: scope.companyId, deletedAt: null, isActive: true }, select: { id: true, reportingManagerId: true, userId: true } }),
    ]);
    if (!delegator) return NextResponse.json({ error: 'Delegator employee not found' }, { status: 404 });
    if (!delegate) return NextResponse.json({ error: 'Delegate employee not found' }, { status: 404 });

    const fromDate = isoToUtcDate(b.fromDate);
    const toDate = isoToUtcDate(b.toDate);
    const scopeType = b.scopeType ?? 'ALL';
    const scopeRefList = scopeType === 'ALL' ? null : (b.scopeRefList ?? '').toUpperCase();

    // Rule 3: chain depth 1 — the delegate must not be delegating their own authority onward to someone else... i.e. a
    // delegator who is themselves currently a delegate under someone else's delegation cannot be delegated *to* by
    // their delegator's authority. What we can enforce at save: the delegator may not be a delegate of the delegate for
    // an overlapping period (A→B and B→A loops), and a delegate never re-delegates received authority because
    // findActorSlot only ever looks one hop.
    const loop = await prisma.workflowDelegation.findFirst({
      where: { companyId: scope.companyId, delegatorEmpId: b.delegateEmpId, delegateEmpId: delegatorEmpId, status: { in: ['Active', 'Pending'] }, fromDate: { lte: toDate }, toDate: { gte: fromDate } },
      select: { id: true },
    });
    if (loop) return NextResponse.json({ error: 'A reciprocal delegation already exists for this period (chain depth is 1)', code: 'WF-DELEG-CHAIN-409' }, { status: 409 });

    // Rule 4: overlapping delegations from one delegator for one scope.
    const overlapping = await prisma.workflowDelegation.findMany({
      where: { companyId: scope.companyId, delegatorEmpId, status: { in: ['Active', 'Pending'] }, fromDate: { lte: toDate }, toDate: { gte: fromDate } },
    });
    const clash = overlapping.find((d) => scopesOverlap(d, { scopeType, scopeRefList }));
    if (clash) return NextResponse.json({ error: `Overlaps delegation ${clash.id} to employee ${clash.delegateEmpId} for the same scope`, code: 'WF-DELEG-OVERLAP-409' }, { status: 409 });

    // §8.4: which path.
    const days = Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS) + 1;
    const directReport = delegate.reportingManagerId === delegatorEmpId;
    const needsApproval = onBehalf || !(directReport && scopeType === 'ALL' && days <= NO_APPROVAL_MAX_DAYS);
    // TODO(§8.4): when needsApproval, raise a DELEGATION_AUTHORITY workflow request (approver: delegator's manager L1,
    // + HR Manager above 45 days, Plant Head above INR 5,00,000 / on behalf) and activate this row from its onApproved
    // handler. Until that hookup exists the row stays Pending and an admin can activate it manually.
    const status = needsApproval ? 'Pending' : 'Active';

    const created = await prisma.workflowDelegation.create({
      data: {
        companyId: scope.companyId,
        delegatorEmpId,
        delegateEmpId: b.delegateEmpId,
        scopeType,
        scopeRefList,
        fromDate,
        toDate,
        amountCeiling: b.amountCeiling === null || b.amountCeiling === undefined ? null : new Prisma.Decimal(typeof b.amountCeiling === 'number' ? b.amountCeiling.toString() : b.amountCeiling),
        reasonCode: b.reasonCode,
        reasonText: b.reasonText ?? null,
        includeInFlight: b.includeInFlight ?? true,
        notifyDelegator: b.notifyDelegator ?? true,
        status,
        createdByUserId: actor.userId,
      },
    });
    await audit({
      companyId: scope.companyId,
      entityType: 'WorkflowDelegation',
      entityId: created.id,
      entityRef: `DEL/${created.id}`,
      action: 'DELEGATE_GRANT',
      actor,
      after: created,
      remark: `${b.reasonCode}${b.reasonText ? ': ' + b.reasonText : ''}`,
    });
    if (status === 'Active') {
      await emitPlatformEvent(scope.companyId, 'WF_DELEGATION_ACTIVE', {
        moduleCode: 'PLAT',
        sourceEntityType: 'WorkflowDelegation',
        sourceEntityId: created.id,
        subjectEmpId: b.delegateEmpId,
        requesterEmpId: delegatorEmpId,
        recipients: [...(delegate.userId ? [`USER:${delegate.userId}`] : ['SUBJECT_EMPLOYEE']), 'REQUESTER'],
        data: { Delegation: { Id: created.id, From: b.fromDate, To: b.toDate, Scope: scopeType, Reason: b.reasonCode } },
      });
    }
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
