/**
 * GET  /api/workforce/on-duty?scope=mine|manager|hr
 *      — mine: the logged-in employee's own OD requests, any status.
 *      — manager: pending_manager requests for this manager's reports
 *        (hierarchy-gated, no RBAC permission needed).
 *      — hr: all pending_hr requests for the company (RBAC-gated on
 *        workforce.on-duty.view).
 * POST /api/workforce/on-duty
 *      — the logged-in employee applies for On-Duty on a date range.
 *        Self-service: employeeId is resolved from the session, never
 *        taken from the request body. New requests start at
 *        'pending_manager' (two-stage approval: Manager → HR).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { onDutyRequestSchema } from '@/lib/validations/workforce';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const scopeParam = request.nextUrl.searchParams.get('scope') ?? 'mine';
  const include = { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } };

  if (scopeParam === 'mine') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId) {
      return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
    }
    const data = await prisma.onDutyRequest.findMany({ where: { employeeId: ownEmployeeId }, include, orderBy: { appliedAt: 'desc' } });
    return NextResponse.json({ data });
  }

  if (scopeParam === 'manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId) {
      return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
    }
    const data = await prisma.onDutyRequest.findMany({
      where: { status: 'pending_manager', employee: { reportingManagerId: ownEmployeeId, companyId: scope.companyId, deletedAt: null } },
      include,
      orderBy: { appliedAt: 'asc' },
    });
    return NextResponse.json({ data });
  }

  if (scopeParam === 'hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.on-duty.view');
    if (permErr) return permErr;
    const data = await prisma.onDutyRequest.findMany({
      where: { status: 'pending_hr', employee: { companyId: scope.companyId } },
      include,
      orderBy: { appliedAt: 'asc' },
    });
    return NextResponse.json({ data });
  }

  // What this caller has already acted on, at either stage. Needs no grant:
  // it is filtered to their own recorded action, so it can only ever return
  // requests they personally decided. Without this an approval vanishes the
  // moment it is actioned, leaving the approver no record of what they did.
  if (scopeParam === 'actioned') {
    const data = await prisma.onDutyRequest.findMany({
      where: {
        employee: { companyId: scope.companyId },
        OR: [{ managerActionByUserId: userId }, { approvedByUserId: userId }],
      },
      include,
      orderBy: [{ approvedAt: 'desc' }, { managerActionAt: 'desc' }],
      take: 50,
    });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: 'scope must be one of: mine, manager, hr, actioned' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const parsed = onDutyRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.onDutyRequest.create({
    data: {
      employeeId: ownEmployeeId,
      fromDate: parsed.data.fromDate,
      toDate: parsed.data.toDate,
      location: parsed.data.location,
      purpose: parsed.data.purpose,
      customerProject: parsed.data.customerProject ?? null,
      remarks: parsed.data.remarks ?? null,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
