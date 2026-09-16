/**
 * POST /api/platform/notification/dispatch (platform.notification.admin)
 *   Run one dispatch cycle for this company now. Body: { limit? }
 *   → { attempted, sent, failed }
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';
import { ntfDispatchSchema } from '@/lib/validations/platform-notification';
import { badRequest, callerUserId } from '@/lib/platform/notification/http';
import { dispatchPending } from '@/lib/platform/notification/service';

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.notification.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const raw = await request.text();
  const parsed = ntfDispatchSchema.safeParse(raw ? JSON.parse(raw) : {});
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

  const summary = await dispatchPending(scope.companyId, parsed.data.limit);
  await audit({
    companyId: scope.companyId,
    entityType: 'NotificationDelivery',
    action: 'DISPATCH',
    actor: { userId: callerUserId(request) },
    after: summary,
    remark: 'Manual dispatch trigger',
  });
  return NextResponse.json(summary);
}
