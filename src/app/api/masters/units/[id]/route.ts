import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { unitSchema } from '@/lib/validations/master';
import { unitHierarchyExtension } from '@/lib/validations/employee-master';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const record = await prisma.unit.findFirst({ where: { id: parseInt(id), deletedAt: null } });
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
  const parsed = unitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  // BRD 01 §5.1: optional parent Business Unit; omitted → unchanged, null → cleared.
  const ext = unitHierarchyExtension.safeParse(body);
  if (!ext.success) return NextResponse.json({ error: 'Validation failed', details: ext.error.flatten() }, { status: 400 });
  if (ext.data.businessUnitId) {
    const bu = await prisma.businessUnit.findFirst({ where: { id: ext.data.businessUnitId, companyId: parsed.data.companyId, deletedAt: null }, select: { id: true } });
    if (!bu) return NextResponse.json({ error: 'Business unit not found in this company' }, { status: 400 });
  }

  // Code is server-generated and never changes after creation — write only
  // the editable fields, ignoring whatever (if anything) the client sent for code.
  const record = await prisma.unit.update({
    where: { id: parseInt(id) },
    data: {
      name: parsed.data.name,
      address: parsed.data.address,
      description: parsed.data.description,
      companyId: parsed.data.companyId,
      isActive: parsed.data.isActive,
      ...(ext.data.businessUnitId !== undefined ? { businessUnitId: ext.data.businessUnitId } : {}),
    },
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
  await prisma.unit.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date(), isActive: false } });
  return NextResponse.json({ message: 'Soft-deleted' });
}
