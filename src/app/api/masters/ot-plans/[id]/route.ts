import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { otPlanSchema } from '@/lib/validations/master';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const record = await prisma.oTPlan.findFirst({
    where: { id: parseInt(id), deletedAt: null },
    include: { payComponent: { select: { id: true, name: true } } },
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
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const parsed = otPlanSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.oTPlan.findFirst({ where: { code: parsed.data.code, NOT: { id: parseInt(id), deletedAt: null } } });
  if (existing && existing.deletedAt === null) return NextResponse.json({ error: 'Code already exists' }, { status: 409 });

  if (parsed.data.payComponentId) {
    const owned = await prisma.salaryComponent.findFirst({
      where: { id: parsed.data.payComponentId, companyId: scope.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: 'Pay Component not found in this company' }, { status: 400 });
  }

  const record = await prisma.oTPlan.update({
    where: { id: parseInt(id) },
    data: parsed.data,
    include: { payComponent: { select: { id: true, name: true } } },
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
  await prisma.oTPlan.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date(), isActive: false } });
  return NextResponse.json({ message: 'Soft-deleted' });
}
