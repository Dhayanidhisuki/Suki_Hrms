/**
 * GET /api/workforce/shift-change-notifications
 *   — list shift change notifications for the logged-in employee.
 *   Admins/HR can pass ?employeeId=X to view another employee's notifications.
 * POST /api/workforce/shift-change-notifications
 *   — mark notifications as read. Body: { ids?: number[] } or { all: true }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const employeeIdParam = request.nextUrl.searchParams.get('employeeId');
  const onlyUnread = request.nextUrl.searchParams.get('unread') === 'true';

  let employeeId: number | undefined;
  if (employeeIdParam) {
    employeeId = Number(employeeIdParam);
  } else {
    // Default: show the logged-in employee's own notifications
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId) {
      return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
    }
    employeeId = ownEmployeeId;
  }

  const where: Record<string, unknown> = {
    employeeId,
    employee: { companyId: scope.companyId },
  };
  if (onlyUnread) where.isRead = false;

  const data = await prisma.shiftChangeNotification.findMany({
    where,
    include: {
      oldShiftMaster: { select: { id: true, code: true, startTime: true, endTime: true } },
      newShiftMaster: { select: { id: true, code: true, startTime: true, endTime: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  if (body?.all) {
    await prisma.shiftChangeNotification.updateMany({
      where: { employeeId: ownEmployeeId, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ marked: 'all' });
  }

  const ids: number[] = body?.ids ?? [];
  if (ids.length > 0) {
    await prisma.shiftChangeNotification.updateMany({
      where: { id: { in: ids }, employeeId: ownEmployeeId },
      data: { isRead: true },
    });
  }
  return NextResponse.json({ marked: ids.length });
}
