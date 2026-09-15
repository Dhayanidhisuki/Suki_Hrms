import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { designationSchema } from '@/lib/validations/master';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const record = await prisma.designation.findFirst({
    where: { id: parseInt(id), deletedAt: null },
    include: { reportsTo: { select: { id: true, name: true } } },
  });
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
  const designationId = parseInt(id);
  const parsed = designationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.designation.findFirst({ where: { id: designationId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Code is server-generated and never changes after creation — write only
  // the editable fields, ignoring whatever (if anything) the client sent for code.
  const { code: _ignored, ...rest } = parsed.data;

  if (parsed.data.reportsToId) {
    if (parsed.data.reportsToId === designationId) {
      return NextResponse.json({ error: 'A designation cannot report to itself' }, { status: 400 });
    }
    const target = await prisma.designation.findFirst({ where: { id: parsed.data.reportsToId, deletedAt: null }, select: { id: true } });
    if (!target) return NextResponse.json({ error: 'Reports To designation not found' }, { status: 400 });
  }

  const record = await prisma.designation.update({
    where: { id: designationId },
    data: rest,
    include: { reportsTo: { select: { id: true, name: true } } },
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
  await prisma.designation.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date(), isActive: false } });
  return NextResponse.json({ message: 'Soft-deleted' });
}
