import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { pfRateSchema } from '@/lib/validations/master';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const record = await prisma.pfRate.findFirst({
    where: { id: parseInt(id) },
    include: { components: { include: { salaryComponent: { select: { id: true, code: true, name: true } } } } },
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
  const parsed = pfRateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.pfRate.findFirst({ where: { code: parsed.data.code, NOT: { id: parseInt(id) } } });
  if (existing) return NextResponse.json({ error: 'Code already exists' }, { status: 409 });

  const { components, ...rateFields } = parsed.data;
  const rateId = parseInt(id);

  await prisma.pfRateComponent.deleteMany({ where: { pfRateId: rateId } });

  const record = await prisma.pfRate.update({
    where: { id: rateId },
    data: {
      ...rateFields,
      components: components?.length
        ? { create: components.map((c) => ({ salaryComponentId: c.salaryComponentId, calculationType: c.calculationType, value: c.value })) }
        : undefined,
    },
    include: { components: { include: { salaryComponent: { select: { id: true, code: true, name: true } } } } },
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
  await prisma.pfRate.update({ where: { id: parseInt(id) }, data: { isActive: false } });
  return NextResponse.json({ message: 'Deactivated' });
}
