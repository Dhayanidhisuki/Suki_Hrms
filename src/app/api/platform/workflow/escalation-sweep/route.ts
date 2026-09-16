/** POST /api/platform/workflow/escalation-sweep — run the §9 sweep for this company now (platform.workflow.admin). */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { runEscalationSweep } from '@/lib/platform/workflow/engine';
import { errorResponse } from '@/lib/platform/workflow/http';

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.workflow.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  try {
    return NextResponse.json(await runEscalationSweep(scope.companyId));
  } catch (err) {
    return errorResponse(err);
  }
}
