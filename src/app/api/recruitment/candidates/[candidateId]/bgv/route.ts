/**
 * Candidate BGV API — list, create, update (BRD §10.3).
 * GET  /api/recruitment/candidates/[candidateId]/bgv
 * POST /api/recruitment/candidates/[candidateId]/bgv
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { candidateBgvSchema } from '@/lib/validations/recruitment';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  const { candidateId } = await params;
  const records = await prisma.candidateBgv.findMany({
    where: { candidateId: parseInt(candidateId) },
    include: { bgvStep: { select: { id: true, stepName: true, stepCode: true } } },
    orderBy: { id: 'asc' },
  });
  return NextResponse.json({ data: records });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  const { candidateId } = await params;
  const body = await request.json();
  const parsed = candidateBgvSchema.safeParse({ ...body, candidateId: parseInt(candidateId) });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.candidateBgv.create({
    data: {
      candidateId: parsed.data.candidateId,
      bgvStepId: parsed.data.bgvStepId,
      status: parsed.data.status,
      contactName: parsed.data.contactName ?? null,
      contactPhone: parsed.data.contactPhone ?? null,
      performedAt: parsed.data.performedAt ?? null,
      outcome: parsed.data.outcome ?? null,
      remarks: parsed.data.remarks ?? null,
    },
    include: { bgvStep: { select: { id: true, stepName: true, stepCode: true } } },
  });

  await prisma.candidateActivityLog.create({
    data: {
      candidateId: parsed.data.candidateId,
      action: `BGV step ${parsed.data.status} — ${record.bgvStep?.stepName ?? ''}`,
      remarks: parsed.data.remarks ?? null,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
