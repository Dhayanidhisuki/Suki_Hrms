/**
 * GET /api/platform/notification/deliveries (platform.notification.view)
 *   ?eventCode= ?status= ?channel= ?recipientId= ?correlationId= ?page= ?limit=
 *   renderedBody and the unmasked recipientAddress are returned only to
 *   platform.notification.admin (§14.7: metadata only for everyone else).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { ntfDeliveryQuerySchema } from '@/lib/validations/platform-notification';
import { badRequest } from '@/lib/platform/notification/http';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.notification.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = ntfDeliveryQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());
  const q = parsed.data;
  const isAdmin = (await checkSpecificPermission(request, 'platform.notification.admin')) === null;

  const where = {
    companyId: scope.companyId,
    ...(q.eventCode ? { eventCode: q.eventCode } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.channel ? { channel: q.channel } : {}),
    ...(q.recipientId ? { recipientId: q.recipientId } : {}),
    ...(q.correlationId ? { correlationId: q.correlationId } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.notificationDelivery.findMany({ where, orderBy: { queuedAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
    prisma.notificationDelivery.count({ where }),
  ]);
  const data = isAdmin
    ? rows
    : rows.map((r) => {
        const { renderedBody: _body, recipientAddress: _addr, ...rest } = r;
        void _body;
        void _addr;
        return rest;
      });
  return NextResponse.json({ data, total, page: q.page, limit: q.limit });
}
