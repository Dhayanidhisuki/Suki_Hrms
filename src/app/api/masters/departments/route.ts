/**
 * GET  /api/masters/departments   — list departments (paginated, soft-delete filtered)
 * POST /api/masters/departments   — create department
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { departmentSchema } from '@/lib/validations/master';
import { currentHeadcounts } from '@/lib/master-headcount';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
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

  const [data, total, headcounts, subDeptCounts] = await Promise.all([
    prisma.department.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.department.count({ where }),
    currentHeadcounts('departmentId'),
    // Sub-department count per department, so the list can link straight
    // into "Sub Departments filtered to this department" without a fetch per row.
    prisma.subDepartment.groupBy({ by: ['departmentId'], where: { deletedAt: null }, _count: { _all: true } }),
  ]);
  const subDeptCountMap = new Map(subDeptCounts.map((g) => [g.departmentId, g._count._all]));

  return NextResponse.json({
    data: data.map((d) => ({
      ...d,
      currentHeadcount: headcounts.get(d.id) ?? 0,
      subDepartmentCount: subDeptCountMap.get(d.id) ?? 0,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const body = await request.json();
  const parsed = departmentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.department.findUnique({
    where: { code: parsed.data.code },
  });
  if (existing && existing.deletedAt === null) {
    return NextResponse.json(
      { error: 'Code already exists' },
      { status: 409 }
    );
  }

  const record = await prisma.department.create({ data: parsed.data });
  return NextResponse.json(record, { status: 201 });
}
