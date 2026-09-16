/**
 * GET /api/platform/document/types/[id] — one type (platform.document.view)
 * PUT /api/platform/document/types/[id] — update a type (platform.document.admin). `code` is immutable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { pdocTypeUpdateSchema } from '@/lib/validations/platform-document';
import { audit } from '@/lib/platform/audit/service';
import { resolveDocumentActor } from '@/lib/platform/document/actor';
import { parseId } from '@/lib/platform/document/http';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'platform.document.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const row = await prisma.platformDocumentType.findFirst({ where: { id, companyId: scope.companyId } });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'platform.document.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = pdocTypeUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const before = await prisma.platformDocumentType.findFirst({ where: { id, companyId: scope.companyId } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const merged = { ...before, ...parsed.data };
  if (merged.verificationRequired && !merged.verifierRole) {
    return NextResponse.json({ error: 'verifierRole is required when verificationRequired is true' }, { status: 400 });
  }

  const updated = await prisma.platformDocumentType.update({ where: { id: before.id }, data: parsed.data });
  const { actor } = await resolveDocumentActor(request, scope.companyId);
  await audit({ companyId: scope.companyId, entityType: 'PlatformDocumentType', entityId: updated.id, entityRef: updated.code, action: 'UPDATE', actor, before, after: updated });
  return NextResponse.json(updated);
}
