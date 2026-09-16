/**
 * POST /api/platform/workflow/requests — create a Draft (platform.workflow.act).
 *      requesterEmpId defaults to the caller's employee; naming another
 *      employee (HR on behalf) requires platform.workflow.admin.
 * GET  /api/platform/workflow/requests — list with filters (platform.workflow.view).
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { createDraft, listRequests } from '@/lib/platform/workflow/engine';
import { errorResponse, isWorkflowAdmin, queryObject, readJson, resolveActor } from '@/lib/platform/workflow/http';
import { wfCreateDraftSchema, wfListQuerySchema } from '@/lib/validations/platform-workflow';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = wfListQuerySchema.safeParse(queryObject(request));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  try {
    return NextResponse.json(await listRequests(scope.companyId, parsed.data));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.act');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = wfCreateDraftSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  try {
    const actor = await resolveActor(request);
    let requesterEmpId = b.requesterEmpId ?? actor.employeeId ?? null;
    if (b.requesterEmpId && b.requesterEmpId !== actor.employeeId) {
      if (!(await isWorkflowAdmin(request))) return NextResponse.json({ error: 'Raising a request for another employee requires platform.workflow.admin' }, { status: 403 });
      requesterEmpId = b.requesterEmpId;
    }
    if (!requesterEmpId) return NextResponse.json({ error: 'Your user is not linked to an employee; pass requesterEmpId' }, { status: 400 });

    const view = await createDraft({
      companyId: scope.companyId,
      requestTypeCode: b.requestTypeCode.toUpperCase(),
      sourceEntityType: b.sourceEntityType,
      sourceEntityId: b.sourceEntityId,
      title: b.title,
      requesterEmpId,
      subjectEmpId: b.subjectEmpId ?? null,
      onBehalfOfEmpId: b.onBehalfOfEmpId ?? null,
      amount: b.amount ?? null,
      requestSubType: b.requestSubType ?? null,
      priority: b.priority,
      payload: b.payload,
      actor,
    });
    return NextResponse.json(view, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
