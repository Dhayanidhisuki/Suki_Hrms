/**
 * GET /api/platform/workflow/requests/[id] — request with slots and history (platform.workflow.view)
 * PUT /api/platform/workflow/requests/[id] — edit while Draft / Validation Failed / Returned (platform.workflow.act)
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { getRequest, updateDraft } from '@/lib/platform/workflow/engine';
import { errorResponse, isWorkflowAdmin, parseId, readJson, resolveActor } from '@/lib/platform/workflow/http';
import { wfUpdateDraftSchema } from '@/lib/validations/platform-workflow';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  try {
    const actor = await resolveActor(request);
    return NextResponse.json(await getRequest(scope.companyId, id, actor, { asAdmin: await isWorkflowAdmin(request) }));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.act');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = wfUpdateDraftSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await resolveActor(request);
    return NextResponse.json(await updateDraft(scope.companyId, id, actor, parsed.data, { asAdmin: await isWorkflowAdmin(request) }));
  } catch (err) {
    return errorResponse(err);
  }
}
