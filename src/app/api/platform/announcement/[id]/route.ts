/**
 * GET    /api/platform/announcement/[id] — one announcement + its read receipts
 * PUT    /api/platform/announcement/[id] — edit (DRAFT only)
 * DELETE /api/platform/announcement/[id] — archive a published item, soft-delete a draft
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';
import { announcementUpdateSchema } from '@/lib/validations/platform-announcement';
import { announcementAudienceEmployeeWhere } from '@/lib/employee/scope';

/** Company-scoped lookup — a bare id from the URL is never trusted. */
async function findInCompany(id: number, companyId: number) {
  return prisma.announcement.findFirst({ where: { id, companyId, deletedAt: null } });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'platform.announcement.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const id = Number((await params).id);
  const row = await findInCompany(id, scope.companyId);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const reads = await prisma.announcementRead.findMany({
    where: { announcementId: id },
    orderBy: { readAt: 'desc' },
    select: {
      readAt: true,
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
    },
  });

  // Who this announcement's audience is (scoped, or every active employee
  // when untargeted), minus whoever already has a read receipt.
  const scopeWhere = announcementAudienceEmployeeWhere(row.audienceScopeType, row.audienceScopeValues);
  const audience = await prisma.employee.findMany({
    where: { companyId: scope.companyId, deletedAt: null, isActive: true, ...(scopeWhere ?? {}) },
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  });
  const readIds = new Set(reads.map((r) => r.employee.id));
  const notRead = audience
    .filter((e) => !readIds.has(e.id))
    .map((e) => ({ employeeId: e.id, employeeCode: e.employeeCode, name: [e.firstName, e.lastName].filter(Boolean).join(' ') }));

  return NextResponse.json({
    ...row,
    reads: reads.map((r) => ({
      employeeId: r.employee.id,
      readAt: r.readAt,
      employeeCode: r.employee.employeeCode,
      name: [r.employee.firstName, r.employee.lastName].filter(Boolean).join(' '),
    })),
    notRead,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'platform.announcement.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const id = Number((await params).id);
  const before = await findInCompany(id, scope.companyId);
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Editing a live circular would change what people already acknowledged, so
  // published items are frozen — withdraw and reissue instead.
  if (before.status !== 'DRAFT') {
    return NextResponse.json(
      { error: 'Only a draft can be edited — archive this one and publish a new announcement instead' },
      { status: 409 }
    );
  }

  const parsed = announcementUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { expiresAt, audienceScopeValues, ...rest } = parsed.data;
  const updated = await prisma.announcement.update({
    where: { id },
    data: {
      ...rest,
      ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
      ...(audienceScopeValues !== undefined
        ? { audienceScopeValues: audienceScopeValues.length ? audienceScopeValues.join(',') : null }
        : {}),
    },
  });

  await audit({
    companyId: scope.companyId,
    entityType: 'Announcement',
    entityId: id,
    entityRef: updated.title,
    action: 'UPDATE',
    actor: { userId: Number(request.headers.get('x-user-id')) || null },
    before,
    after: updated,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'platform.announcement.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const id = Number((await params).id);
  const before = await findInCompany(id, scope.companyId);
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // A published circular is a record of what staff were told — it is archived,
  // never deleted. Only an unpublished draft disappears.
  const updated =
    before.status === 'DRAFT'
      ? await prisma.announcement.update({ where: { id }, data: { deletedAt: new Date() } })
      : await prisma.announcement.update({ where: { id }, data: { status: 'ARCHIVED' } });

  await audit({
    companyId: scope.companyId,
    entityType: 'Announcement',
    entityId: id,
    entityRef: before.title,
    action: before.status === 'DRAFT' ? 'DELETE' : 'ARCHIVE',
    actor: { userId: Number(request.headers.get('x-user-id')) || null },
    before,
    after: updated,
  });

  return NextResponse.json({ ok: true, status: updated.status, deleted: before.status === 'DRAFT' });
}
