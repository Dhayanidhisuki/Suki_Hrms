/**
 * GET / PUT / DELETE (soft) /api/masters/locations/[id] — company-scoped.
 * Deactivation / deletion is blocked while any employee holds the location
 * on a current or future-dated job row (BRD 01 §5.2).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { locationSchema } from '@/lib/validations/employee-master';
import { audit } from '@/lib/platform/audit/service';

type Ctx = { params: Promise<{ id: string }> };

async function heldByEmployees(locationId: number): Promise<number> {
  return prisma.jobInfo.count({
    where: { locationId, OR: [{ effectiveTo: null }, { effectiveFrom: { gt: new Date() } }], employee: { deletedAt: null } },
  });
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const permErr = await checkSpecificPermission(request, 'masters.org.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const record = await prisma.location.findFirst({ where: { id: parseInt(id), companyId: scope.companyId, deletedAt: null } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const permErr = await checkSpecificPermission(request, 'masters.org.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const recordId = parseInt(id);

  const existing = await prisma.location.findFirst({ where: { id: recordId, companyId: scope.companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = locationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.code !== existing.code) {
    const dup = await prisma.location.findUnique({ where: { companyId_code: { companyId: scope.companyId, code: data.code } } });
    if (dup) return NextResponse.json({ error: 'Location code already exists in this company' }, { status: 409 });
  }
  if (data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: data.siteId, companyId: scope.companyId, deletedAt: null }, select: { id: true } });
    if (!site) return NextResponse.json({ error: 'Site not found in this company' }, { status: 400 });
  }
  if (!data.isActive && existing.isActive) {
    const held = await heldByEmployees(recordId);
    if (held > 0) return NextResponse.json({ error: `Cannot deactivate: ${held} employee job record(s) hold this location` }, { status: 409 });
  }

  const record = await prisma.location.update({
    where: { id: recordId },
    data: { code: data.code, name: data.name, siteId: data.siteId ?? null, locationType: data.locationType, address: data.address ?? null, isActive: data.isActive },
  });
  await audit({
    companyId: scope.companyId,
    entityType: 'Location',
    entityId: record.id,
    entityRef: record.code,
    action: 'UPDATE',
    actor: { userId: Number(request.headers.get('x-user-id')) || null },
    before: existing,
    after: record,
  });
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const permErr = await checkSpecificPermission(request, 'masters.org.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const recordId = parseInt(id);

  const existing = await prisma.location.findFirst({ where: { id: recordId, companyId: scope.companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const held = await heldByEmployees(recordId);
  if (held > 0) return NextResponse.json({ error: `Cannot delete: ${held} employee job record(s) hold this location` }, { status: 409 });

  await prisma.location.update({ where: { id: recordId }, data: { deletedAt: new Date(), isActive: false } });
  await audit({
    companyId: scope.companyId,
    entityType: 'Location',
    entityId: recordId,
    entityRef: existing.code,
    action: 'SOFT_DELETE',
    actor: { userId: Number(request.headers.get('x-user-id')) || null },
    before: existing,
  });
  return NextResponse.json({ message: 'Soft-deleted' });
}
