import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { holidayMasterSchema } from '@/lib/validations/master';

const holidayInputSchema = holidayMasterSchema.omit({ companyId: true });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const record = await prisma.holidayMaster.findFirst({
    where: { id: parseInt(id), companyId: scope.companyId, deletedAt: null },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const holidayId = parseInt(id);

  const parsed = holidayInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const owned = await prisma.holidayMaster.findFirst({
    where: { id: holidayId, companyId: scope.companyId, deletedAt: null },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const clash = await prisma.holidayMaster.findFirst({
    where: { companyId: scope.companyId, date: parsed.data.date, NOT: { id: holidayId } },
    select: { id: true, deletedAt: true },
  });
  if (clash) {
    // A live row on that date is a genuine conflict; a soft-deleted one
    // would still violate the unique key, so it is removed to make way.
    if (clash.deletedAt === null) {
      return NextResponse.json({ error: 'A holiday already exists on this date' }, { status: 409 });
    }
    await prisma.holidayMaster.delete({ where: { id: clash.id } });
  }

  const record = await prisma.holidayMaster.update({ where: { id: holidayId }, data: parsed.data });
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const { count } = await prisma.holidayMaster.updateMany({
    where: { id: parseInt(id), companyId: scope.companyId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  });
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ message: 'Soft-deleted' });
}
