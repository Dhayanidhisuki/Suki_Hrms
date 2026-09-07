/**
 * GET  /api/masters/shift-rotation-plans — list, each with its ordered shift cycle
 * POST /api/masters/shift-rotation-plans — create a plan + its slots in one transaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { shiftRotationPlanSchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';

  const where = {
    deletedAt: null,
    ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.shiftRotationPlan.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { slots: { orderBy: { sequenceOrder: 'asc' }, include: { shiftMaster: { select: { id: true, code: true, name: true, startTime: true, endTime: true } } } } },
    }),
    prisma.shiftRotationPlan.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const body = await request.json();
  const parsed = shiftRotationPlanSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.shiftRotationPlan.findUnique({ where: { code: parsed.data.code } });
  if (existing && existing.deletedAt === null) return NextResponse.json({ error: 'Code already exists' }, { status: 409 });

  const { shiftMasterIds, ...planData } = parsed.data;
  const record = await prisma.$transaction(async (tx) => {
    const plan = await tx.shiftRotationPlan.create({ data: planData });
    await tx.shiftRotationSlot.createMany({
      data: shiftMasterIds.map((shiftMasterId, sequenceOrder) => ({ shiftRotationPlanId: plan.id, sequenceOrder, shiftMasterId })),
    });
    return tx.shiftRotationPlan.findUniqueOrThrow({
      where: { id: plan.id },
      include: { slots: { orderBy: { sequenceOrder: 'asc' }, include: { shiftMaster: { select: { id: true, code: true, name: true, startTime: true, endTime: true } } } } },
    });
  });

  return NextResponse.json(record, { status: 201 });
}
