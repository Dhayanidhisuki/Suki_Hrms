/**
 * POST /api/workforce/my-announcements/[id]/read — record that the signed-in
 * employee has opened this announcement.
 *
 * Idempotent: re-opening an item must not create a second receipt, and the
 * unique index on (announcementId, employeeId) is what guarantees that even if
 * two tabs post at once.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const announcementId = Number((await params).id);
  // Company-scoped, so an id from another tenant reads as "not found" rather
  // than silently writing a receipt against it.
  const announcement = await prisma.announcement.findFirst({
    where: { id: announcementId, companyId: scope.companyId, status: 'PUBLISHED', deletedAt: null },
    select: { id: true },
  });
  if (!announcement) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const receipt = await prisma.announcementRead.upsert({
    where: { announcementId_employeeId: { announcementId, employeeId: ownEmployeeId } },
    create: { announcementId, employeeId: ownEmployeeId },
    update: {},
    select: { readAt: true },
  });

  return NextResponse.json({ ok: true, readAt: receipt.readAt });
}
