/** POST /api/platform/workflow/requests/[id]/approve — Approve verb (platform.workflow.act; slot holder or delegate). Body: { remark? } */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { approve } from '@/lib/platform/workflow/engine';
import { errorResponse, parseId, readJson, resolveActor } from '@/lib/platform/workflow/http';
import { wfApproveSchema } from '@/lib/validations/platform-workflow';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.act');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = wfApproveSchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await resolveActor(request);
    return NextResponse.json(await approve(scope.companyId, id, actor, parsed.data.remark));
  } catch (err) {
    return errorResponse(err);
  }
}
