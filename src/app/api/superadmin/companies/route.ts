/**
 * GET  /api/superadmin/companies   — list companies (paginated, soft-delete filtered)
 * POST /api/superadmin/companies   — create company
 *
 * Company is the tenant root, not a regular editable master — moved here
 * (from the old /api/masters/companies) so only a superadmin can create or
 * edit tenants. Same Prisma shape/validation as before, just re-gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/rbac-superadmin';
import { companySchema } from '@/lib/validations/company';

export async function GET(request: NextRequest) {
  const permErr = await requireSuperAdmin(request);
  if (permErr) return permErr;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';

  const where = {
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

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          where: { role: { code: 'company-admin' }, deletedAt: null },
          select: { email: true, isActive: true },
          take: 1,
        },
      },
    }),
    prisma.company.count({ where }),
  ]);

  const data = companies.map(({ users, ...company }) => ({
    ...company,
    admin: users[0] ? { email: users[0].email, isActive: users[0].isActive } : null,
  }));

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const permErr = await requireSuperAdmin(request);
  if (permErr) return permErr;
  const body = await request.json();
  const parsed = companySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.company.findUnique({
    where: { code: parsed.data.code },
  });
  if (existing && existing.deletedAt === null) {
    return NextResponse.json(
      { error: 'Code already exists' },
      { status: 409 }
    );
  }

  const record = await prisma.company.create({ data: parsed.data });
  return NextResponse.json(record, { status: 201 });
}
