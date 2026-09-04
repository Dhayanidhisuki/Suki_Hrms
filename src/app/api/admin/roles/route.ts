/**
 * GET  /api/admin/roles   — list roles (paginated, soft-delete filtered),
 *                           annotated with the count of granted permissions
 * POST /api/admin/roles   — create role
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAdminPermission } from '@/lib/rbac-admin';
import { getCompanyId } from '@/lib/companyScope';
import { roleSchema } from '@/lib/validations/role';

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
    ...(search
      ? {
          OR: [
            { code: { contains: search } },
            { name: { contains: search } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.role.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { rolePermissions: true } } },
    }),
    prisma.role.count({ where }),
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
  const parsed = roleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.role.findUnique({
    where: { companyId_code: { companyId: scope.companyId, code: parsed.data.code } },
  });
  if (existing && existing.deletedAt === null) {
    return NextResponse.json(
      { error: 'Code already exists' },
      { status: 409 }
    );
  }

  const record = await prisma.role.create({ data: { ...parsed.data, companyId: scope.companyId } });
  return NextResponse.json(record, { status: 201 });
}
