/**
 * GET  /api/admin/users   — list users (paginated, soft-delete filtered),
 *                           joined with their role's name/code
 * POST /api/admin/users   — create user (password is bcrypt-hashed before storage)
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { checkAdminPermission } from '@/lib/rbac-admin';
import { getCompanyId } from '@/lib/companyScope';
import { userCreateSchema } from '@/lib/validations/user';

export async function GET(request: NextRequest) {
  const permErr = await checkAdminPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';

  const where = {
    companyId: scope.companyId,
    deletedAt: null,
    ...(search ? { email: { contains: search } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        loginId: true,
        roleId: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const permErr = await checkAdminPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const body = await request.json();
  const parsed = userCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing && existing.deletedAt === null) {
    return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
  }

  // companyId scoped so a company-admin can't assign a user to another
  // company's role by guessing its id.
  const role = await prisma.role.findFirst({
    where: { id: parsed.data.roleId, companyId: scope.companyId, isActive: true, deletedAt: null },
  });
  if (!role) {
    return NextResponse.json({ error: 'Invalid role — it may be inactive or deleted' }, { status: 400 });
  }

  // Optional Employee link (Add User's Employee ID picker). loginId is
  // derived server-side from the employee's own code — never trust a
  // client-supplied loginId — and the employee must not already have a
  // different linked account (same uniqueness rule the Job Profile tab's
  // own "linked login account" field enforces). "Employee ID/Code"
  // throughout the app is oldEmployeeCode (company-issued, may be blank),
  // never substituting employeeCode (the system-generated "Reference Code")
  // when it's blank.
  let loginId: string | null = null;
  let linkedEmployeeId: number | null = null;
  if (parsed.data.employeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: parsed.data.employeeId, companyId: scope.companyId, deletedAt: null },
      select: { id: true, oldEmployeeCode: true, userId: true },
    });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found in this company' }, { status: 400 });
    }
    if (employee.userId) {
      return NextResponse.json({ error: 'This employee already has a linked login account' }, { status: 409 });
    }
    loginId = employee.oldEmployeeCode;
    linkedEmployeeId = employee.id;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const record = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: parsed.data.email,
        loginId,
        passwordHash,
        companyId: scope.companyId,
        roleId: parsed.data.roleId,
        isActive: parsed.data.isActive,
      },
      select: {
        id: true,
        email: true,
        loginId: true,
        roleId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, code: true, name: true } },
      },
    });
    if (linkedEmployeeId) {
      await tx.employee.update({ where: { id: linkedEmployeeId }, data: { userId: user.id } });
    }
    return user;
  });

  return NextResponse.json(record, { status: 201 });
}
