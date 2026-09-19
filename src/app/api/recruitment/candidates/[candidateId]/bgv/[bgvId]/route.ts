/**
 * Candidate BGV [bgvId] — PATCH (update status), DELETE (BRD §10.3).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { candidateBgvSchema } from '@/lib/validations/recruitment';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string; bgvId: string }> }
) {
  const { candidateId, bgvId } = await params;
  const body = await request.json();
  const parsed = candidateBgvSchema.safeParse({ ...body, candidateId: parseInt(candidateId) });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.candidateBgv.findFirst({
    where: { id: parseInt(bgvId), candidateId: parseInt(candidateId) },
  });
  if (!existing) return NextResponse.json({ error: 'BGV record not found' }, { status: 404 });

  const record = await prisma.candidateBgv.update({
    where: { id: parseInt(bgvId) },
    data: {
      status: parsed.data.status,
      contactName: parsed.data.contactName ?? existing.contactName,
      contactPhone: parsed.data.contactPhone ?? existing.contactPhone,
      performedAt: parsed.data.performedAt ?? existing.performedAt,
      outcome: parsed.data.outcome ?? existing.outcome,
      remarks: parsed.data.remarks ?? existing.remarks,
    },
    include: { bgvStep: { select: { id: true, stepName: true, stepCode: true } } },
  });

  await prisma.candidateActivityLog.create({
    data: {
      candidateId: parseInt(candidateId),
      action: `BGV ${parsed.data.status} — ${record.bgvStep?.stepName ?? ''}`,
      remarks: parsed.data.remarks ?? null,
    },
  });

  return NextResponse.json(record);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string; bgvId: string }> }
) {
  const { bgvId } = await params;
  await prisma.candidateBgv.delete({ where: { id: parseInt(bgvId) } });
  return NextResponse.json({ message: 'Deleted' }, { status: 200 });
}
