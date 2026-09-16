/**
 * POST /api/platform/notification/inbox/read-all — mark every unread in-app
 * message of the caller read. → { updated }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { callerEmployeeId, callerUserId } from '@/lib/platform/notification/http';

export async function POST(request: NextRequest) {
  const userId = callerUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const empId = await callerEmployeeId(userId, scope.companyId);
  const now = new Date();
  const where = {
    companyId: scope.companyId,
    isRead: false,
    OR: [{ recipientUserId: userId }, ...(empId ? [{ recipientEmpId: empId }] : [])],
  };
  const rows = await prisma.notificationInApp.findMany({ where, select: { id: true, deliveryId: true } });
  if (rows.length === 0) return NextResponse.json({ updated: 0 });

  const { count } = await prisma.notificationInApp.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { isRead: true, readAt: now } });
  const deliveryIds = rows.map((r) => r.deliveryId).filter((d): d is number => d !== null);
  if (deliveryIds.length) {
    await prisma.notificationDelivery
      .updateMany({ where: { id: { in: deliveryIds }, status: { in: ['Delivered', 'Sent'] } }, data: { status: 'Read', readAt: now } })
      .catch(() => {});
  }
  return NextResponse.json({ updated: count });
}
