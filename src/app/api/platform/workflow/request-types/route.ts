/**
 * GET  /api/platform/workflow/request-types      — list (platform.workflow.view)
 * POST /api/platform/workflow/request-types      — register a request type (platform.workflow.admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';
import { errorResponse, readJson, resolveActor } from '@/lib/platform/workflow/http';
import { wfRequestTypeSchema } from '@/lib/validations/platform-workflow';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const includeInactive = request.nextUrl.searchParams.get('includeInactive') === '1';
  const data = await prisma.workflowRequestType.findMany({
    where: { companyId: scope.companyId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: [{ moduleCode: 'asc' }, { code: 'asc' }],
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = wfRequestTypeSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  try {
    const actor = await resolveActor(request);
    const created = await prisma.workflowRequestType.create({
      data: { ...parsed.data, code: parsed.data.code.toUpperCase(), companyId: scope.companyId },
    });
    await audit({ companyId: scope.companyId, entityType: 'WorkflowRequestType', entityId: created.id, entityRef: created.code, action: 'CREATE', actor, after: created });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
