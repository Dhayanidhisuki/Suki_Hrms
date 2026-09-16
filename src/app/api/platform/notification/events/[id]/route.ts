/**
 * PUT /api/platform/notification/events/[id] — update an event's switches,
 * recipients or metadata (platform.notification.admin). Code is immutable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';
import { ntfEventUpdateSchema } from '@/lib/validations/platform-notification';
import { badRequest, callerUserId } from '@/lib/platform/notification/http';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'platform.notification.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return badRequest('Invalid id');

  const parsed = ntfEventUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());
  if (parsed.data.contextSchemaJson) {
    try {
      JSON.parse(parsed.data.contextSchemaJson);
    } catch {
      return badRequest('contextSchemaJson must be valid JSON');
    }
  }

  const before = await prisma.notificationEvent.findFirst({ where: { id, companyId: scope.companyId } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.notificationEvent.update({ where: { id: before.id }, data: parsed.data });
  await audit({
    companyId: scope.companyId,
    entityType: 'NotificationEvent',
    entityId: updated.id,
    entityRef: updated.code,
    action: 'UPDATE',
    actor: { userId: callerUserId(request) },
    before,
    after: updated,
  });
  return NextResponse.json(updated);
}
