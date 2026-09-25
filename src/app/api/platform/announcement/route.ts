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
import { announcementAudienceEmployeeWhere } from '@/lib/employee/scope';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.announcement.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const search = searchParams.get('search') ?? '';

  const where = {
    companyId: scope.companyId,
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(search ? { title: { contains: search } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
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
        audienceScopeType: true,
        audienceScopeValues: true,
        _count: { select: { reads: true } },
      },
    }),
    prisma.announcement.count({ where }),
  ]);

  // How many employees each row is measured against, so the HR list can show
  // "7 of 18 read" — scoped to that row's target audience when it has one,
  // otherwise every active employee of the company.
  const data = await Promise.all(
    rows.map(async ({ _count, audienceScopeType, audienceScopeValues, ...a }) => {
      const scopeWhere = announcementAudienceEmployeeWhere(audienceScopeType, audienceScopeValues);
      const audienceSize = await prisma.employee.count({
        where: { companyId: scope.companyId, deletedAt: null, isActive: true, ...(scopeWhere ?? {}) },
      });
      return { ...a, audienceScopeType, audienceScopeValues, readCount: _count.reads, audienceSize };
    })
  );

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
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
      audienceScopeType: parsed.data.audienceScopeType ?? null,
      audienceScopeValues: parsed.data.audienceScopeValues?.length ? parsed.data.audienceScopeValues.join(',') : null,
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
