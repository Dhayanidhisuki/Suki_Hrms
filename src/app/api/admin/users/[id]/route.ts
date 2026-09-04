/**
 * GET    /api/admin/users/[id]   — get single user
 * PUT    /api/admin/users/[id]   — update user (email/roleId/isActive always;
 *                                  password re-hashed only when a non-empty
 *                                  password is present in the body)
 * DELETE /api/admin/users/[id]   — soft-delete user
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { checkAdminPermission } from '@/lib/rbac-admin';
import { getCompanyId } from '@/lib/companyScope';
import { userUpdateSchema } from '@/lib/validations/user';

/**
 * True if `userId` is currently the only active company-admin IN THIS
 * COMPANY — used to block the last admin of a company from being
 * deactivated, deleted, or moved off the role, which would leave nobody
 * able to reach that company's Admin UI at all.
 */
async function isLastActiveCompanyAdmin(
  companyId: number,
  userId: number,
  currentRoleId: number
): Promise<boolean> {
  const companyAdminRole = await prisma.role.findUnique({
    where: { companyId_code: { companyId, code: 'company-admin' } },
  });
  if (!companyAdminRole || currentRoleId !== companyAdminRole.id) return false;
  const otherActiveAdmins = await prisma.user.count({
    where: { roleId: companyAdminRole.id, isActive: true, deletedAt: null, NOT: { id: userId } },
  });
  return otherActiveAdmins === 0;
}

const userSelect = {
  id: true,
  email: true,
  roleId: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, code: true, name: true } },
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkAdminPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const record = await prisma.user.findFirst({
    where: { id: parseInt(id), companyId: scope.companyId, deletedAt: null },
    select: userSelect,
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
  const parsed = userUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Self-lockout guard: don't let a user deactivate their own account —
  // there'd be no other way back into the Admin UI to undo it.
  const selfId = Number(request.headers.get('x-user-id'));
  if (targetId === selfId && parsed.data.isActive === false) {
    return NextResponse.json(
      { error: 'You cannot deactivate your own account.' },
      { status: 400 }
    );
  }

  const targetUser = await prisma.user.findFirst({
    where: { id: targetId, companyId: scope.companyId, deletedAt: null },
  });
  if (!targetUser) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Last-admin guard: block deactivating, or moving off company-admin, the
  // only remaining active company-admin — otherwise nobody can undo it.
  const losingCompanyAdmin = parsed.data.isActive === false || parsed.data.roleId !== targetUser.roleId;
  if (losingCompanyAdmin && (await isLastActiveCompanyAdmin(scope.companyId, targetId, targetUser.roleId!))) {
    return NextResponse.json(
      { error: 'This is the last active company-admin. Promote another user to company-admin before changing this one.' },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findFirst({
    where: { email: parsed.data.email, NOT: { id: targetId } },
  });
  if (existing && existing.deletedAt === null) {
    return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
  }

  const role = await prisma.role.findFirst({
    where: { id: parsed.data.roleId, companyId: scope.companyId, isActive: true, deletedAt: null },
  });
  if (!role) {
    return NextResponse.json({ error: 'Invalid role — it may be inactive or deleted' }, { status: 400 });
  }

  const data: {
    email: string;
    roleId: number;
    isActive: boolean;
    passwordHash?: string;
  } = {
    email: parsed.data.email,
    roleId: parsed.data.roleId,
    isActive: parsed.data.isActive,
  };

  if (parsed.data.password) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  const record = await prisma.user.update({
    where: { id: targetId },
    data,
    select: userSelect,
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
  const targetId = parseInt(id);

  const selfId = Number(request.headers.get('x-user-id'));
  if (targetId === selfId) {
    return NextResponse.json(
      { error: 'You cannot delete your own account.' },
      { status: 400 }
    );
  }

  const targetUser = await prisma.user.findFirst({
    where: { id: targetId, companyId: scope.companyId, deletedAt: null },
  });
  if (!targetUser) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (await isLastActiveCompanyAdmin(scope.companyId, targetId, targetUser.roleId!)) {
    return NextResponse.json(
      { error: 'Cannot delete the last active company-admin. Promote another user to company-admin first.' },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: targetId },
    data: { deletedAt: new Date(), isActive: false },
  });

  return NextResponse.json({ message: 'Soft-deleted' }, { status: 200 });
}
