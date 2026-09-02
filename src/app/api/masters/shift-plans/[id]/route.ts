import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { shiftPlanSchema } from '@/lib/validations/master';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const record = await prisma.shiftPlan.findFirst({ where: { id: parseInt(id), deletedAt: null }, include: { shiftMaster: { select: { id: true, name: true, code: true } } } });
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
  const parsed = shiftPlanSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.shiftPlan.findFirst({ where: { code: parsed.data.code, NOT: { id: parseInt(id), deletedAt: null } } });
  if (existing && existing.deletedAt === null) return NextResponse.json({ error: 'Code already exists' }, { status: 409 });

  const record = await prisma.shiftPlan.update({ where: { id: parseInt(id) }, data: parsed.data, include: { shiftMaster: { select: { id: true, name: true, code: true } } } });
  return NextResponse.json(record);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  await prisma.shiftPlan.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date(), isActive: false } });
  return NextResponse.json({ message: 'Soft-deleted' });
}
