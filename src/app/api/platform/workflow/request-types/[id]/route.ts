/**
 * GET /api/platform/workflow/request-types/[id]  — one request type (platform.workflow.view)
 * PUT /api/platform/workflow/request-types/[id]  — update flags/name (platform.workflow.admin); code is immutable
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';
import { errorResponse, parseId, readJson, resolveActor } from '@/lib/platform/workflow/http';
import { wfRequestTypeUpdateSchema } from '@/lib/validations/platform-workflow';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const row = await prisma.workflowRequestType.findFirst({ where: { id, companyId: scope.companyId } });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = wfRequestTypeUpdateSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  try {
    const before = await prisma.workflowRequestType.findFirst({ where: { id, companyId: scope.companyId } });
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const actor = await resolveActor(request);
    const updated = await prisma.workflowRequestType.update({ where: { id }, data: parsed.data });
    await audit({ companyId: scope.companyId, entityType: 'WorkflowRequestType', entityId: id, entityRef: before.code, action: 'CONFIG_CHANGE', actor, before, after: updated });
    return NextResponse.json(updated);
  } catch (err) {
    return errorResponse(err);
  }
}
