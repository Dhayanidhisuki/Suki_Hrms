import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { subDepartmentSchema } from '@/lib/validations/master';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const record = await prisma.subDepartment.findFirst({ where: { id: parseInt(id), deletedAt: null }, include: { department: { select: { id: true, name: true } } } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const parsed = subDepartmentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.subDepartment.findFirst({
    where: { departmentId: parsed.data.departmentId, code: parsed.data.code, NOT: { id: parseInt(id) } },
  });
  if (existing) return NextResponse.json({ error: 'Sub-Code already exists for this department' }, { status: 409 });

  const record = await prisma.subDepartment.update({
    where: { id: parseInt(id) },
    data: {
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description,
      departmentId: parsed.data.departmentId,
      sanctionedHeadcount: parsed.data.sanctionedHeadcount,
      isActive: parsed.data.isActive,
    },
    include: { department: { select: { id: true, name: true } } },
  });
  return NextResponse.json(record);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  await prisma.subDepartment.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date(), isActive: false } });
  return NextResponse.json({ message: 'Soft-deleted' });
}
