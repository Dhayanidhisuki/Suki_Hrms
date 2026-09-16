/**
 * GET /api/platform/audit?entityType=&entityId=&limit=&before= — read the audit trail (platform.audit.view).
 * Reading the trail is itself audited (§20.4 note): a VIEW row naming the filter and row count.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit, readAudit } from '@/lib/platform/audit/service';
import { errorResponse, queryObject, resolveActor } from '@/lib/platform/workflow/http';
import { audQuerySchema } from '@/lib/validations/platform-workflow';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.audit.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = audQuerySchema.safeParse(queryObject(request));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const q = parsed.data;

  try {
    const data = await readAudit({
      companyId: scope.companyId,
      entityType: q.entityType,
      entityId: q.entityId,
      limit: q.limit,
      before: q.before ? new Date(q.before) : undefined,
    });
    const actor = await resolveActor(request);
    await audit({
      companyId: scope.companyId,
      entityType: 'AuditLog',
      action: 'VIEW',
      actor,
      after: { filter: q, rowCount: data.length },
    });
    return NextResponse.json({ data });
  } catch (err) {
    return errorResponse(err);
  }
}
