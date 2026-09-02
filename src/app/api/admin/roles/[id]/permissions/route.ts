/**
 * GET /api/admin/roles/[id]/permissions   — the role's currently granted
 *                                            permission ids, as number[]
 * PUT /api/admin/roles/[id]/permissions   — replace the role's full
 *                                            permission set with the given
 *                                            { permissionIds: number[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAdminPermission } from '@/lib/rbac-admin';
import { rolePermissionsSchema } from '@/lib/validations/role';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkAdminPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const roleId = parseInt(id);

  const role = await prisma.role.findFirst({ where: { id: roleId, deletedAt: null }, select: { id: true } });
  if (!role) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 });
  }

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permissionId: true },
  });

  return NextResponse.json(rolePermissions.map((rp) => rp.permissionId));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkAdminPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const roleId = parseInt(id);

  const role = await prisma.role.findFirst({ where: { id: roleId, deletedAt: null }, select: { id: true } });
  if (!role) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 });
  }

  const parsed = rolePermissionsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const desiredIds = parsed.data.permissionIds;
  const desiredSet = new Set(desiredIds);

  // Reject unknown/inactive permission ids up front instead of letting a
  // bad id hit the FK constraint on rolePermission.create and 500.
  const validPerms = await prisma.permission.findMany({
    where: { id: { in: desiredIds }, isActive: true, deletedAt: null },
    select: { id: true },
  });
  const validIds = new Set(validPerms.map((p) => p.id));
  const invalidIds = desiredIds.filter((pid) => !validIds.has(pid));
  if (invalidIds.length > 0) {
    return NextResponse.json(
      { error: 'Unknown or inactive permission id(s)', invalidIds },
      { status: 400 }
    );
  }

  // Self-lockout guard: if you're editing your OWN role's permissions,
  // you must keep admin.roles.edit — otherwise this save would be the last
  // thing you could ever do in Role management.
  const selfRoleId = Number(request.headers.get('x-role-id'));
  if (roleId === selfRoleId) {
    const editPerm = await prisma.permission.findUnique({ where: { code: 'admin.roles.edit' } });
    if (editPerm && !desiredSet.has(editPerm.id)) {
      return NextResponse.json(
        { error: 'You cannot remove your own admin.roles.edit permission — that would lock you out of role management.' },
        { status: 400 }
      );
    }
  }

  const current = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permissionId: true },
  });
  const currentIds = new Set(current.map((rp) => rp.permissionId));

  const toRemove = [...currentIds].filter((pid) => !desiredSet.has(pid));
  const toAdd = desiredIds.filter((pid) => !currentIds.has(pid));

  await prisma.$transaction([
    ...(toRemove.length
      ? [prisma.rolePermission.deleteMany({ where: { roleId, permissionId: { in: toRemove } } })]
      : []),
    ...toAdd.map((permissionId) =>
      prisma.rolePermission.create({ data: { roleId, permissionId } })
    ),
  ]);

  return NextResponse.json({ message: 'Permissions updated', permissionIds: desiredIds });
}
