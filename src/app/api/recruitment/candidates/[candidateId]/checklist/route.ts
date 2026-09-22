/**
 * Candidate Checklist — GET list of checklist items for a candidate.
 * BRD §7.1.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  const { candidateId } = await params;
  const records = await prisma.candidateChecklistItem.findMany({
    where: { candidateId: parseInt(candidateId) },
    include: { checklistMaster: { select: { id: true, itemName: true, itemCode: true } } },
    orderBy: { id: 'asc' },
  });
  return NextResponse.json({ data: records });
}
