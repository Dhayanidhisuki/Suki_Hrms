/**
 * POST /api/platform/announcement/[id]/clone — duplicate as a new DRAFT.
 *
 * A published announcement is frozen (see [id]/route.ts PUT), so revising one
 * means cloning it into an editable draft rather than editing it in place.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'platform.announcement.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const id = Number((await params).id);
  const source = await prisma.announcement.findFirst({ where: { id, companyId: scope.companyId, deletedAt: null } });
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const userId = Number(request.headers.get('x-user-id')) || null;

  const cloned = await prisma.announcement.create({
    data: {
      companyId: scope.companyId,
      title: source.title.startsWith('Copy of ') ? source.title : `Copy of ${source.title}`,
      body: source.body,
      category: source.category,
      priority: source.priority,
      status: 'DRAFT',
      expiresAt: source.expiresAt,
      audienceScopeType: source.audienceScopeType,
      audienceScopeValues: source.audienceScopeValues,
      createdByUserId: userId,
    },
  });

  await audit({
    companyId: scope.companyId,
    entityType: 'Announcement',
    entityId: cloned.id,
    entityRef: cloned.title,
    action: 'CREATE',
    actor: { userId },
    after: cloned,
  });

  return NextResponse.json(cloned, { status: 201 });
}
