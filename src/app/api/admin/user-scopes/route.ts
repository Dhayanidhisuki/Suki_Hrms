/**
 * GET  /api/admin/user-scopes?userId= — data-scope assignments (BRD 01 §20)
 *      for the company's users, joined with the user's email / role.
 * POST /api/admin/user-scopes — assign a scope to a user.
 *      Body: { userId, scopeType, scopeValues?: string[], treeDepth? }
 * Gated by admin.users.* like the Users screen.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { userScopeSchema } from '@/lib/validations/employee-master';
import { audit } from '@/lib/platform/audit/service';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'admin.users.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const userIdParam = request.nextUrl.searchParams.get('userId');
  const rows = await prisma.userScope.findMany({
    where: { companyId: scope.companyId, isActive: true, ...(userIdParam ? { userId: Number(userIdParam) } : {}) },
    orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }],
  });

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, role: { select: { code: true, name: true } } } })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json({
    data: rows.map((r) => ({
      ...r,
      scopeValues: r.scopeValues ? r.scopeValues.split(',').map((s) => s.trim()).filter(Boolean) : [],
      user: userById.get(r.userId) ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'admin.users.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = userScopeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const user = await prisma.user.findFirst({ where: { id: data.userId, companyId: scope.companyId, deletedAt: null }, select: { id: true } });
  if (!user) return NextResponse.json({ error: 'User not found in this company' }, { status: 404 });

  if (data.scopeType === 'GLOBAL' && request.headers.get('x-is-superadmin') !== 'true') {
    return NextResponse.json({ error: 'GLOBAL scope can only be granted by a superadmin' }, { status: 403 });
  }

  const scopeValues = data.scopeValues?.length ? [...new Set(data.scopeValues)].join(',') : null;
  if (scopeValues && scopeValues.length > 2000) {
    return NextResponse.json({ error: 'Too many scope values' }, { status: 400 });
  }

  const record = await prisma.userScope.create({
    data: {
      companyId: scope.companyId,
      userId: data.userId,
      scopeType: data.scopeType,
      scopeValues,
      treeDepth: data.scopeType === 'REPORTING_TREE' ? data.treeDepth : null,
      createdByUserId: Number(request.headers.get('x-user-id')) || null,
    },
  });
  await audit({
    companyId: scope.companyId,
    entityType: 'UserScope',
    entityId: record.id,
    entityRef: `user:${data.userId}`,
    action: 'CREATE',
    actor: { userId: Number(request.headers.get('x-user-id')) || null },
    after: record,
  });
  return NextResponse.json(record, { status: 201 });
}
