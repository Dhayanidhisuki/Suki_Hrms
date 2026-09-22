import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { competencySchema } from '@/lib/validations/learning';

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
  const record = await prisma.competency.findFirst({
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
  const numericId = parseInt(id);

  const existing = await prisma.competency.findFirst({
    where: { id: numericId, companyId, deletedAt: null },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const parsed = competencySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Code is system-generated — never overwritten on update.
  const data = { ...parsed.data };
  delete data.code;

  const record = await prisma.competency.update({
    where: { id: numericId },
    data,
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

  const record = await prisma.competency.findFirst({
    where: { id: parseInt(id), companyId, deletedAt: null },
  });
  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.competency.update({
    where: { id: parseInt(id) },
    data: { deletedAt: new Date(), isActive: false },
  });

  return NextResponse.json({ message: 'Soft-deleted' }, { status: 200 });
}
