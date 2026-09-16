/** POST /api/platform/workflow/requests/[id]/submit — Submit verb (platform.workflow.act; requester or admin). */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { submit } from '@/lib/platform/workflow/engine';
import { errorResponse, isWorkflowAdmin, parseId, resolveActor } from '@/lib/platform/workflow/http';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.act');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  try {
    const actor = await resolveActor(request);
    return NextResponse.json(await submit(scope.companyId, id, actor, { asAdmin: await isWorkflowAdmin(request) }));
  } catch (err) {
    return errorResponse(err);
  }
}
