/**
 * GET  /api/masters/locations — list (search / pagination / ?siteId=), company-scoped
 * POST /api/masters/locations — create (BRD 01 §5.2: locationCode, siteCode,
 *      locationType = PLANT | BRANCH | CORPORATE_OFFICE | WAREHOUSE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { locationSchema } from '@/lib/validations/employee-master';
import { audit } from '@/lib/platform/audit/service';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.org.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '20') || 20));
  const search = searchParams.get('search') ?? '';
  const siteId = searchParams.get('siteId');

  const where = {
    companyId: scope.companyId,
    deletedAt: null,
    ...(siteId ? { siteId: parseInt(siteId) } : {}),
    ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.location.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { code: 'asc' } }),
    prisma.location.count({ where }),
  ]);

  const siteIds = [...new Set(rows.map((r) => r.siteId).filter((v): v is number => v !== null))];
  const sites = siteIds.length ? await prisma.site.findMany({ where: { id: { in: siteIds } }, select: { id: true, code: true, name: true } }) : [];
  const siteById = new Map(sites.map((s) => [s.id, s]));

  return NextResponse.json({
    data: rows.map((r) => ({ ...r, site: r.siteId ? (siteById.get(r.siteId) ?? null) : null })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.org.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = locationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const dup = await prisma.location.findUnique({ where: { companyId_code: { companyId: scope.companyId, code: data.code } } });
  if (dup) return NextResponse.json({ error: 'Location code already exists in this company' }, { status: 409 });

  if (data.siteId) {
    const site = await prisma.site.findFirst({ where: { id: data.siteId, companyId: scope.companyId, deletedAt: null }, select: { id: true } });
    if (!site) return NextResponse.json({ error: 'Site not found in this company' }, { status: 400 });
  }

  const record = await prisma.location.create({
    data: {
      companyId: scope.companyId,
      code: data.code,
      name: data.name,
      siteId: data.siteId ?? null,
      locationType: data.locationType,
      address: data.address ?? null,
      isActive: data.isActive,
    },
  });
  await audit({
    companyId: scope.companyId,
    entityType: 'Location',
    entityId: record.id,
    entityRef: record.code,
    action: 'CREATE',
    actor: { userId: Number(request.headers.get('x-user-id')) || null },
    after: record,
  });
  return NextResponse.json(record, { status: 201 });
}
