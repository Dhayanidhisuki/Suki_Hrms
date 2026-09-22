import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { skillLevelSchema } from '@/lib/validations/learning';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!request.headers.get('x-role-id')) return unauthorized();

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const { id } = await params;
  const record = await prisma.skillLevel.findFirst({
    where: { id: parseInt(id), companyId, deletedAt: null },
  });

  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(record);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!request.headers.get('x-role-id')) return unauthorized();

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const { id } = await params;
  const body = await request.json();
  const parsed = skillLevelSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.skillLevel.findFirst({
    where: {
      companyId,
      levelNumber: parsed.data.levelNumber,
      NOT: { id: parseInt(id) },
      deletedAt: null,
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'Level number already exists for this company' },
      { status: 409 }
    );
  }

  const record = await prisma.skillLevel.update({
    where: { id: parseInt(id) },
    data: parsed.data,
  });

  return NextResponse.json(record);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!request.headers.get('x-role-id')) return unauthorized();

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const { id } = await params;

  const record = await prisma.skillLevel.findFirst({
    where: { id: parseInt(id), companyId, deletedAt: null },
  });
  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.skillLevel.update({
    where: { id: parseInt(id) },
    data: { deletedAt: new Date(), isActive: false },
  });

  return NextResponse.json({ message: 'Soft-deleted' }, { status: 200 });
}
