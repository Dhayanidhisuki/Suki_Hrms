/**
 * GET /api/platform/workflow/inbox — the one approver inbox (platform.workflow.view).
 *   ?status=&requestTypeCode=&page=&limit=   pending on me, directly or under delegation
 *   ?mine=1                                  requests I raised / am the subject of, all statuses
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { inbox } from '@/lib/platform/workflow/engine';
import { errorResponse, queryObject, resolveActor } from '@/lib/platform/workflow/http';
import { wfInboxQuerySchema } from '@/lib/validations/platform-workflow';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = wfInboxQuerySchema.safeParse(queryObject(request));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await resolveActor(request);
    const { mine, ...rest } = parsed.data;
    return NextResponse.json(await inbox(scope.companyId, actor, { ...rest, mine: mine === '1' || mine === 'true' }));
  } catch (err) {
    return errorResponse(err);
  }
}
