/**
 * GET  /api/workforce/permission?scope=mine|manager|hr
 *      — mine: the logged-in employee's own requests, any status.
 *      — manager: pending_manager requests for this manager's reports
 *        (hierarchy-gated, no RBAC permission needed).
 *      — hr: all pending_hr requests for the company (RBAC-gated on
 *        workforce.permission.view).
 * POST /api/workforce/permission
 *      — the logged-in employee applies for permission (short leave in
 *        hours) on one of their own days. Self-service: employeeId is
 *        resolved from the session, never taken from the request body.
 *        New requests start at status 'pending_manager' (two-stage
 *        approval: Manager → HR).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { permissionRequestSchema } from '@/lib/validations/workforce';

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
    const data = await prisma.permissionRequest.findMany({ where: { employeeId: ownEmployeeId }, include, orderBy: { appliedAt: 'desc' } });
    return NextResponse.json({ data });
  }

  if (scopeParam === 'manager') {
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId) {
      return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
    }
    const data = await prisma.permissionRequest.findMany({
      where: { status: 'pending_manager', employee: { reportingManagerId: ownEmployeeId, companyId: scope.companyId, deletedAt: null } },
      include,
      orderBy: { appliedAt: 'asc' },
    });
    return NextResponse.json({ data });
  }

  if (scopeParam === 'hr') {
    const permErr = await checkSpecificPermission(request, 'workforce.permission.view');
    if (permErr) return permErr;
    const data = await prisma.permissionRequest.findMany({
      where: { status: 'pending_hr', employee: { companyId: scope.companyId } },
      include,
      orderBy: { appliedAt: 'asc' },
    });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: 'scope must be one of: mine, manager, hr' }, { status: 400 });
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

  const parsed = permissionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const hours = Math.round(((parsed.data.toTime.getTime() - parsed.data.fromTime.getTime()) / 3600000) * 100) / 100;

  const record = await prisma.permissionRequest.create({
    data: {
      employeeId: ownEmployeeId,
      date: parsed.data.date,
      fromTime: parsed.data.fromTime,
      toTime: parsed.data.toTime,
      hours,
      reason: parsed.data.reason ?? null,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
