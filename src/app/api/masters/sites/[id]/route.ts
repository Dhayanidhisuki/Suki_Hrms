import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { siteSchema } from '@/lib/validations/master';
import { siteHierarchyExtension } from '@/lib/validations/employee-master';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const record = await prisma.site.findFirst({
    where: { id: parseInt(id), deletedAt: null },
    include: { company: { select: { id: true, name: true } } },
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
  const body = await request.json();
  const parsed = siteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  // BRD 01 §5.1: optional parent Unit; omitted → unchanged, null → cleared.
  const ext = siteHierarchyExtension.safeParse(body);
  if (!ext.success) return NextResponse.json({ error: 'Validation failed', details: ext.error.flatten() }, { status: 400 });
  if (ext.data.unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: ext.data.unitId, companyId: parsed.data.companyId, deletedAt: null }, select: { id: true } });
    if (!unit) return NextResponse.json({ error: 'Unit not found in this company' }, { status: 400 });
  }

  // Code is server-generated and never changes after creation — write only
  // the editable fields, ignoring whatever (if anything) the client sent for code.
  const { code: _ignored, ...rest } = parsed.data;

  const record = await prisma.site.update({
    where: { id: parseInt(id) },
    data: { ...rest, ...(ext.data.unitId !== undefined ? { unitId: ext.data.unitId } : {}) },
    include: { company: { select: { id: true, name: true } } },
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
  await prisma.site.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date(), isActive: false } });
  return NextResponse.json({ message: 'Soft-deleted' });
}
