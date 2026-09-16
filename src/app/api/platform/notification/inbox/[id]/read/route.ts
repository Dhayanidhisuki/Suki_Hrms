/**
 * POST /api/platform/notification/inbox/[id]/read — mark one of the caller's
 * in-app messages read. Someone else's row → 404.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { callerEmployeeId, callerUserId } from '@/lib/platform/notification/http';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = callerUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const empId = await callerEmployeeId(userId, scope.companyId);
  const row = await prisma.notificationInApp.findFirst({
    where: { id, companyId: scope.companyId, OR: [{ recipientUserId: userId }, ...(empId ? [{ recipientEmpId: empId }] : [])] },
  });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (row.isRead) return NextResponse.json(row);
  const now = new Date();
  const updated = await prisma.notificationInApp.update({ where: { id: row.id }, data: { isRead: true, readAt: now } });
  if (row.deliveryId) {
    await prisma.notificationDelivery
      .updateMany({ where: { id: row.deliveryId, status: { in: ['Delivered', 'Sent'] } }, data: { status: 'Read', readAt: now } })
      .catch(() => {});
  }
  return NextResponse.json(updated);
}
