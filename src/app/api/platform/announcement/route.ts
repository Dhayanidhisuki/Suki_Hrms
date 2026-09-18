/**
 * GET  /api/platform/announcement  — list announcements (platform.announcement.view)
 * POST /api/platform/announcement  — create a DRAFT    (platform.announcement.admin)
 *
 * HR-side authoring. Employees never touch this route; they read published
 * items through /api/workforce/my-announcements.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';
import { announcementCreateSchema } from '@/lib/validations/platform-announcement';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.announcement.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const status = request.nextUrl.searchParams.get('status');

  const rows = await prisma.announcement.findMany({
    where: {
      companyId: scope.companyId,
      deletedAt: null,
      ...(status ? { status } : {}),
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      body: true,
      category: true,
      priority: true,
      status: true,
      publishedAt: true,
      expiresAt: true,
      createdAt: true,
      _count: { select: { reads: true } },
    },
  });

  // How many employees a published item is measured against, so the HR list can
  // show "7 of 18 read" rather than a bare receipt count.
  const audienceSize = await prisma.employee.count({
    where: { companyId: scope.companyId, deletedAt: null, isActive: true },
  });

  return NextResponse.json({
    data: rows.map(({ _count, ...a }) => ({ ...a, readCount: _count.reads })),
    audienceSize,
  });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.announcement.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = announcementCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const userId = Number(request.headers.get('x-user-id')) || null;

  const created = await prisma.announcement.create({
    data: {
      companyId: scope.companyId,
      title: parsed.data.title,
      body: parsed.data.body,
      category: parsed.data.category,
      priority: parsed.data.priority,
      status: 'DRAFT',
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      createdByUserId: userId,
    },
  });

  await audit({
    companyId: scope.companyId,
    entityType: 'Announcement',
    entityId: created.id,
    entityRef: created.title,
    action: 'CREATE',
    actor: { userId },
    after: created,
  });

  return NextResponse.json(created, { status: 201 });
}
