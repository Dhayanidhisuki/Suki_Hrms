/**
 * GET  /api/platform/notification/events   — registered events (platform.notification.view)
 * POST /api/platform/notification/events   — register an event (platform.notification.admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';
import { ntfEventCreateSchema } from '@/lib/validations/platform-notification';
import { badRequest, callerUserId } from '@/lib/platform/notification/http';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.notification.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const moduleCode = request.nextUrl.searchParams.get('moduleCode');
  const data = await prisma.notificationEvent.findMany({
    where: { companyId: scope.companyId, ...(moduleCode ? { moduleCode } : {}) },
    orderBy: [{ moduleCode: 'asc' }, { code: 'asc' }],
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.notification.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = ntfEventCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());
  if (parsed.data.contextSchemaJson) {
    try {
      JSON.parse(parsed.data.contextSchemaJson);
    } catch {
      return badRequest('contextSchemaJson must be valid JSON');
    }
  }

  const exists = await prisma.notificationEvent.findFirst({ where: { companyId: scope.companyId, code: parsed.data.code }, select: { id: true } });
  if (exists) return NextResponse.json({ error: `Event ${parsed.data.code} already exists` }, { status: 409 });

  const category = parsed.data.category;
  const created = await prisma.notificationEvent.create({
    data: {
      ...parsed.data,
      companyId: scope.companyId,
      quietHoursExempt: parsed.data.quietHoursExempt ?? (parsed.data.defaultPriority === 'URGENT' || category === 'STATUTORY'),
      digestEligible: parsed.data.digestEligible ?? (category === 'INFORMATIONAL' || category === 'REMINDER'),
    },
  });
  await audit({
    companyId: scope.companyId,
    entityType: 'NotificationEvent',
    entityId: created.id,
    entityRef: created.code,
    action: 'CREATE',
    actor: { userId: callerUserId(request) },
    after: created,
  });
  return NextResponse.json(created, { status: 201 });
}
