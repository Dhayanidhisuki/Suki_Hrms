/**
 * Candidate [id] — GET, PUT (update), DELETE (soft-delete).
 * BRD §5.3, §5.18.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { candidateUpdateSchema } from '@/lib/validations/recruitment';

const candidateInclude = {
  department: { select: { id: true, name: true, code: true } },
  designation: { select: { id: true, name: true, code: true } },
  jobPosting: { select: { id: true, title: true } },
  sourceChannel: { select: { id: true, channelName: true } },
  currentStatus: { select: { id: true, statusCode: true, statusName: true, color: true } },
  createdBy: { select: { id: true, email: true } },
} as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  const record = await prisma.candidate.findFirst({
    where: { id: parseInt(candidateId), deletedAt: null },
    include: candidateInclude,
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...record, fullName: `${record.firstName} ${record.lastName}` });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  const body = await request.json();
  const parsed = candidateUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.candidate.update({
    where: { id: parseInt(candidateId) },
    data: parsed.data,
    include: candidateInclude,
  });
  return NextResponse.json({ ...record, fullName: `${record.firstName} ${record.lastName}` });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  await prisma.candidate.update({
    where: { id: parseInt(candidateId) },
    data: { deletedAt: new Date(), isActive: false },
  });
  return NextResponse.json({ message: 'Soft-deleted' }, { status: 200 });
}
