/** POST /api/platform/workflow/requests/[id]/resubmit — Re-submit from Returned (platform.workflow.act; requester). Body: optional { title, amount, requestSubType, payload } edits */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resubmit } from '@/lib/platform/workflow/engine';
import { errorResponse, isWorkflowAdmin, parseId, readJson, resolveActor } from '@/lib/platform/workflow/http';
import { wfResubmitSchema } from '@/lib/validations/platform-workflow';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.act');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = wfResubmitSchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await resolveActor(request);
    const patch = Object.keys(parsed.data).length ? parsed.data : undefined;
    return NextResponse.json(await resubmit(scope.companyId, id, actor, { asAdmin: await isWorkflowAdmin(request), patch }));
  } catch (err) {
    return errorResponse(err);
  }
}
