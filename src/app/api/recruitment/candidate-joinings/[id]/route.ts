/**
 * Candidate Joining [id] — GET, PUT (update), DELETE.
 * BRD §5.16.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { candidateJoiningUpdateSchema } from '@/lib/validations/recruitment';

const include = {
  candidate: { select: { id: true, applicationNo: true, firstName: true, lastName: true, department: { select: { name: true } }, designation: { select: { name: true } } } },
  offerLetter: { select: { id: true, offerNo: true } },
  approver: { select: { id: true, firstName: true, lastName: true } },
} as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await prisma.candidateJoining.findUnique({ where: { id: parseInt(id) }, include });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = candidateJoiningUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const record = await prisma.candidateJoining.update({
    where: { id: parseInt(id) },
    data: parsed.data,
    include,
  });
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.candidateJoining.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ message: 'Deleted' }, { status: 200 });
}
