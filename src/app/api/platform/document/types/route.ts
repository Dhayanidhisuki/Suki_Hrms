/**
 * GET  /api/platform/document/types           — list document types (platform.document.view)
 *      ?appliesToEntity=EMPLOYEE  ?includeInactive=1
 * POST /api/platform/document/types           — create a type (platform.document.admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { pdocTypeCreateSchema } from '@/lib/validations/platform-document';
import { audit } from '@/lib/platform/audit/service';
import { resolveDocumentActor } from '@/lib/platform/document/actor';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.document.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const appliesToEntity = request.nextUrl.searchParams.get('appliesToEntity');
  const includeInactive = request.nextUrl.searchParams.get('includeInactive') === '1';
  const data = await prisma.platformDocumentType.findMany({
    where: {
      companyId: scope.companyId,
      ...(appliesToEntity ? { appliesToEntity: appliesToEntity.toUpperCase() } : {}),
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ appliesToEntity: 'asc' }, { code: 'asc' }],
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.document.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = pdocTypeCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const created = await prisma.platformDocumentType.create({
      data: { companyId: scope.companyId, ...parsed.data },
    });
    const { actor } = await resolveDocumentActor(request, scope.companyId);
    await audit({ companyId: scope.companyId, entityType: 'PlatformDocumentType', entityId: created.id, entityRef: created.code, action: 'CREATE', actor, after: created });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: `Document type ${parsed.data.code} already exists` }, { status: 409 });
    }
    console.error('[platform/document/types] create failed:', err);
    return NextResponse.json({ error: 'Could not create document type' }, { status: 500 });
  }
}
