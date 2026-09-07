import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { shiftRotationPlanSchema } from '@/lib/validations/master';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const record = await prisma.shiftRotationPlan.findFirst({
    where: { id: parseInt(id), deletedAt: null },
    include: { slots: { orderBy: { sequenceOrder: 'asc' }, include: { shiftMaster: { select: { id: true, code: true, name: true, startTime: true, endTime: true } } } } },
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
  const planId = parseInt(id);
  const parsed = shiftRotationPlanSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.shiftRotationPlan.findFirst({ where: { code: parsed.data.code, NOT: { id: planId } } });
  if (existing && existing.deletedAt === null) return NextResponse.json({ error: 'Code already exists' }, { status: 409 });

  const { shiftMasterIds, ...planData } = parsed.data;
  const record = await prisma.$transaction(async (tx) => {
    await tx.shiftRotationPlan.update({ where: { id: planId }, data: planData });
    // Slots have no independent identity worth preserving — replace the
    // whole ordered list rather than diffing it.
    await tx.shiftRotationSlot.deleteMany({ where: { shiftRotationPlanId: planId } });
    await tx.shiftRotationSlot.createMany({
      data: shiftMasterIds.map((shiftMasterId, sequenceOrder) => ({ shiftRotationPlanId: planId, sequenceOrder, shiftMasterId })),
    });
    return tx.shiftRotationPlan.findUniqueOrThrow({
      where: { id: planId },
      include: { slots: { orderBy: { sequenceOrder: 'asc' }, include: { shiftMaster: { select: { id: true, code: true, name: true, startTime: true, endTime: true } } } } },
    });
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
  await prisma.shiftRotationPlan.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date(), isActive: false } });
  return NextResponse.json({ message: 'Soft-deleted' });
}
