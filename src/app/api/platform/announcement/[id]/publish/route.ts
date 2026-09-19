/**
 * POST /api/platform/announcement/[id]/publish — DRAFT → PUBLISHED
 *
 * Publishing does two things: it makes the item visible on /ess/announcements,
 * and it raises ANNOUNCEMENT_PUBLISHED so every active employee gets the bell
 * notification the MoM asks for. The notification is best-effort — a failure in
 * the notification engine must not leave the announcement half-published, so it
 * runs after the status change and only logs on error.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';
import { notify } from '@/lib/platform/notification/service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'platform.announcement.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const id = Number((await params).id);
  const before = await prisma.announcement.findFirst({
    where: { id, companyId: scope.companyId, deletedAt: null },
  });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (before.status !== 'DRAFT') {
    return NextResponse.json({ error: `Already ${before.status.toLowerCase()}` }, { status: 409 });
  }

  const userId = Number(request.headers.get('x-user-id')) || null;

  const published = await prisma.announcement.update({
    where: { id },
    data: { status: 'PUBLISHED', publishedAt: new Date(), publishedByUserId: userId },
  });

  await audit({
    companyId: scope.companyId,
    entityType: 'Announcement',
    entityId: id,
    entityRef: published.title,
    action: 'PUBLISH',
    actor: { userId },
    before,
    after: published,
  });

  // Audience: every active employee in the company that has a login to receive
  // it. An employee with no user account has nowhere to show a bell, so they
  // are skipped here and simply see the item next time they are given one.
  let notified = 0;
  try {
    const audience = await prisma.employee.findMany({
      where: { companyId: scope.companyId, deletedAt: null, isActive: true, userId: { not: null } },
      // employeeCode, not id: the EMPLOYEE:<x> recipient expression resolves
      // by code, and an id silently matches nobody.
      select: { employeeCode: true },
    });

    if (audience.length) {
      const result = await notify(scope.companyId, 'ANNOUNCEMENT_PUBLISHED', {
        moduleCode: 'PLAT',
        sourceEntityType: 'Announcement',
        sourceEntityId: id,
        priority: published.priority === 'IMPORTANT' ? 'URGENT' : 'NORMAL',
        linkPath: `/ess/announcements?id=${id}`,
        recipients: audience.map((e) => `EMPLOYEE:${e.employeeCode}`),
        data: {
          Announcement: {
            Title: published.title,
            Category: published.category,
          },
          Link: { Announcement: `/ess/announcements?id=${id}` },
        },
      });
      notified = result.deliveryIds.length;
    }
  } catch (error) {
    // The announcement IS published; only the fan-out failed.
    console.error('[announcement] publish notification failed:', error);
  }

  return NextResponse.json({ ...published, notified });
}
