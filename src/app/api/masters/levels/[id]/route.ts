import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { levelSchema } from '@/lib/validations/master';

const gradeSelect = { grade: { select: { id: true, name: true } } };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const record = await prisma.level.findFirst({ where: { id: parseInt(id), deletedAt: null }, include: gradeSelect });
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
  const parsed = levelSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const grade = await prisma.grade.findFirst({ where: { id: parsed.data.gradeId, deletedAt: null }, select: { id: true } });
  if (!grade) return NextResponse.json({ error: 'Grade not found' }, { status: 400 });

  // Code is unique per grade — "L1" may exist under several grades.
  const existing = await prisma.level.findFirst({
    where: { code: parsed.data.code, gradeId: parsed.data.gradeId, deletedAt: null, NOT: { id: parseInt(id) } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: 'Code already exists under this grade' }, { status: 409 });

  const record = await prisma.level.update({ where: { id: parseInt(id) }, data: parsed.data, include: gradeSelect });
  return NextResponse.json(record);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  await prisma.level.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date(), isActive: false } });
  return NextResponse.json({ message: 'Soft-deleted' });
}
