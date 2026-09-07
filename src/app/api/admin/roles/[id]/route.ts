/**
 * GET    /api/admin/roles/[id]   — get single role
 * PUT    /api/admin/roles/[id]   — update role
 * DELETE /api/admin/roles/[id]   — soft-delete role
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAdminPermission } from '@/lib/rbac-admin';
import { getCompanyId } from '@/lib/companyScope';
import { roleSchema } from '@/lib/validations/role';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkAdminPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const record = await prisma.role.findFirst({
    where: { id: parseInt(id), companyId: scope.companyId, deletedAt: null },
    include: { _count: { select: { rolePermissions: true } } },
  });

  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(record);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkAdminPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const targetId = parseInt(id);
  const body = await request.json();
  const parsed = roleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const target = await prisma.role.findFirst({
    where: { id: targetId, companyId: scope.companyId, deletedAt: null },
  });
  if (!target) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const existing = await prisma.role.findFirst({
    where: { companyId: scope.companyId, code: parsed.data.code, NOT: { id: targetId } },
  });
  if (existing && existing.deletedAt === null) {
    return NextResponse.json(
      { error: 'Code already exists' },
      { status: 409 }
    );
  }

  const record = await prisma.role.update({
    where: { id: targetId },
    data: parsed.data,
  });

  return NextResponse.json(record);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkAdminPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const roleId = parseInt(id);

  const target = await prisma.role.findFirst({
    where: { id: roleId, companyId: scope.companyId, deletedAt: null },
  });
  if (!target) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // A role with active users still assigned can't be soft-deleted out from
  // under them — hasPermission() now checks the role's own isActive/
  // deletedAt state, so those users would silently lose all access with no
  // warning. Require reassigning them first.
  const activeUsers = await prisma.user.count({ where: { roleId, deletedAt: null } });
  if (activeUsers > 0) {
    return NextResponse.json(
      {
        error: `This role has ${activeUsers} active user${activeUsers === 1 ? '' : 's'} assigned. Reassign them to another role before deleting.`,
      },
      { status: 409 }
    );
  }

  await prisma.role.update({
    where: { id: roleId },
    data: { deletedAt: new Date(), isActive: false },
  });

  return NextResponse.json({ message: 'Soft-deleted' }, { status: 200 });
}
