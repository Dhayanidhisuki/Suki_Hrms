import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { deductionRateSchema, validateSlabOverlap } from '@/lib/validations/master';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const record = await prisma.deductionRate.findFirst({ where: { id: parseInt(id), companyId: scope.companyId } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const existingRecord = await prisma.deductionRate.findFirst({ where: { id: parseInt(id), companyId: scope.companyId } });
  if (!existingRecord) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = deductionRateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const siblings = await prisma.deductionRate.findMany({
    where: { companyId: scope.companyId, code: parsed.data.code, NOT: { id: parseInt(id) } },
  });
  const overlapError = validateSlabOverlap(
    siblings.map((r) => ({ id: r.id, effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo })),
    parsed.data.effectiveFrom,
    parsed.data.effectiveTo ?? null
  );
  if (overlapError) return NextResponse.json({ error: overlapError }, { status: 409 });

  const record = await prisma.deductionRate.update({ where: { id: parseInt(id) }, data: parsed.data });
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const existingRecord = await prisma.deductionRate.findFirst({ where: { id: parseInt(id), companyId: scope.companyId } });
  if (!existingRecord) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.deductionRate.update({ where: { id: parseInt(id) }, data: { isActive: false } });
  return NextResponse.json({ message: 'Deactivated' });
}
