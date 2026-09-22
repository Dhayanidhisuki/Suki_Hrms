/**
 * Checklist Item update — PATCH /api/recruitment/candidates/:candidateId/checklist/:itemId
 * BRD §7.1. Status: Received (green) | Not Received (yellow) | Not Required (red).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checklistItemUpdateSchema } from '@/lib/validations/recruitment';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string; itemId: string }> }
) {
  const { candidateId, itemId } = await params;
  const body = await request.json();
  const parsed = checklistItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.candidateChecklistItem.findFirst({
    where: { id: parseInt(itemId), candidateId: parseInt(candidateId) },
  });
  if (!existing) return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });

  const record = await prisma.candidateChecklistItem.update({
    where: { id: parseInt(itemId) },
    data: { status: parsed.data.status },
    include: { checklistMaster: { select: { id: true, itemName: true, itemCode: true } } },
  });

  return NextResponse.json(record);
}

/**
 * GET — list all checklist items for a candidate.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string; itemId: string }> }
) {
  const { candidateId } = await params;
  const records = await prisma.candidateChecklistItem.findMany({
    where: { candidateId: parseInt(candidateId) },
    include: { checklistMaster: { select: { id: true, itemName: true, itemCode: true } } },
    orderBy: { id: 'asc' },
  });
  return NextResponse.json({ data: records });
}
