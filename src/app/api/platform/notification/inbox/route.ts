/**
 * GET /api/platform/notification/inbox
 *   The caller's in-app messages (by x-user-id, plus the caller's employee
 *   row when one exists). ?unread=1 · ?page= · ?limit=
 *   → { data, unreadCount, total, page, limit }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { ntfInboxQuerySchema } from '@/lib/validations/platform-notification';
import { badRequest, callerEmployeeId, callerUserId } from '@/lib/platform/notification/http';

export async function GET(request: NextRequest) {
  const userId = callerUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = ntfInboxQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());
  const { page, limit } = parsed.data;
  const unreadOnly = parsed.data.unread === '1' || parsed.data.unread === 'true';

  const empId = await callerEmployeeId(userId, scope.companyId);
  const mine = {
    companyId: scope.companyId,
    OR: [{ recipientUserId: userId }, ...(empId ? [{ recipientEmpId: empId }] : [])],
  };
  const where = unreadOnly ? { ...mine, isRead: false } : mine;

  const [data, total, unreadCount] = await Promise.all([
    prisma.notificationInApp.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.notificationInApp.count({ where }),
    prisma.notificationInApp.count({ where: { ...mine, isRead: false } }),
  ]);
  return NextResponse.json({ data, unreadCount, total, page, limit });
}
