import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { subDepartmentSchema } from '@/lib/validations/master';
import { currentHeadcounts } from '@/lib/master-headcount';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';
  const departmentId = searchParams.get('departmentId');

  const where = {
    deletedAt: null,
    ...(departmentId ? { departmentId: parseInt(departmentId) } : {}),
    ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}),
  };

  const [data, total, headcounts] = await Promise.all([
    prisma.subDepartment.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { department: { select: { id: true, name: true } } },
    }),
    prisma.subDepartment.count({ where }),
    currentHeadcounts('subDepartmentId'),
  ]);

  return NextResponse.json({
    data: data.map((d) => ({ ...d, currentHeadcount: headcounts.get(d.id) ?? 0 })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const body = await request.json();
  const parsed = subDepartmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const department = await prisma.department.findFirst({ where: { id: parsed.data.departmentId, deletedAt: null }, select: { id: true } });
  if (!department) return NextResponse.json({ error: 'Department not found' }, { status: 400 });

  const existing = await prisma.subDepartment.findFirst({
    where: { departmentId: parsed.data.departmentId, code: parsed.data.code },
  });
  if (existing) return NextResponse.json({ error: 'Sub-Code already exists for this department' }, { status: 409 });

  const record = await prisma.subDepartment.create({ data: parsed.data, include: { department: { select: { id: true, name: true } } } });
  return NextResponse.json(record, { status: 201 });
}
