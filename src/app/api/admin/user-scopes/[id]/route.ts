/**
 * DELETE /api/admin/user-scopes/[id] — revoke a scope assignment (soft:
 * isActive = false so the access log keeps the row, BRD 01 §20.3 rule 10).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'admin.users.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const existing = await prisma.userScope.findFirst({ where: { id: parseInt(id), companyId: scope.companyId, isActive: true } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.userScope.update({ where: { id: existing.id }, data: { isActive: false } });
  await audit({
    companyId: scope.companyId,
    entityType: 'UserScope',
    entityId: existing.id,
    entityRef: `user:${existing.userId}`,
    action: 'REVOKE',
    actor: { userId: Number(request.headers.get('x-user-id')) || null },
    before: existing,
  });
  return NextResponse.json({ message: 'Scope revoked' });
}
