/**
 * Interview Process [id] — GET, PUT (with level sync), DELETE.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { interviewProcessSchema } from '@/lib/validations/recruitment';
import { z } from 'zod';

const processLevelSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  interviewLevelId: z.coerce.number().int().positive(),
  interviewTypeId: z.coerce.number().int().positive(),
  sequence: z.coerce.number().int().min(0),
  mandatory: z.boolean().default(true),
  passScore: z.coerce.number().min(0).max(100).optional().nullable(),
});

const updateProcessSchema = interviewProcessSchema.extend({
  levels: z.array(processLevelSchema).default([]),
});

const includeLevels = { levels: { include: { interviewLevel: true, interviewType: true } } };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const record = await prisma.interviewProcess.findFirst({
    where: { id: parseInt(id), deletedAt: null },
    include: { department: true, designation: true, ...includeLevels },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const body = await request.json();
  const parsed = updateProcessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { levels, ...processData } = parsed.data;
  const processId = parseInt(id);

  // Sync child levels: delete removed, update existing, create new
  const existingLevels = await prisma.interviewProcessLevel.findMany({ where: { processId } });
  const incomingIds = new Set(levels.filter((l) => l.id).map((l) => l.id!));
  const toDelete = existingLevels.filter((l) => !incomingIds.has(l.id));

  await prisma.$transaction(async (tx) => {
    // Delete removed levels
    if (toDelete.length) {
      await tx.interviewProcessLevel.deleteMany({ where: { id: { in: toDelete.map((l) => l.id) } } });
    }
    // Update existing + create new
    for (const level of levels) {
      if (level.id) {
        await tx.interviewProcessLevel.update({
          where: { id: level.id },
          data: {
            interviewLevelId: level.interviewLevelId,
            interviewTypeId: level.interviewTypeId,
            sequence: level.sequence,
            mandatory: level.mandatory,
            passScore: level.passScore,
          },
        });
      } else {
        await tx.interviewProcessLevel.create({
          data: {
            processId,
            interviewLevelId: level.interviewLevelId,
            interviewTypeId: level.interviewTypeId,
            sequence: level.sequence,
            mandatory: level.mandatory,
            passScore: level.passScore,
          },
        });
      }
    }
    // Update process itself
    await tx.interviewProcess.update({ where: { id: processId }, data: processData });
  });

  const record = await prisma.interviewProcess.findUnique({ where: { id: processId }, include: includeLevels });
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  await prisma.interviewProcess.update({
    where: { id: parseInt(id) },
    data: { deletedAt: new Date(), isActive: false },
  });
  return NextResponse.json({ message: 'Soft-deleted' }, { status: 200 });
}
