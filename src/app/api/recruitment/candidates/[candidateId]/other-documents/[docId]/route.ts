/**
 * Candidate Other Document [docId] — PATCH (verify/reject), DELETE (BRD §7.8).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { candidateOtherDocumentSchema } from '@/lib/validations/recruitment';

const include = {
  otherDocType: { select: { id: true, docCode: true, docName: true, mandatory: true } },
} as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string; docId: string }> }
) {
  const { candidateId, docId } = await params;
  const body = await request.json();
  const parsed = candidateOtherDocumentSchema.safeParse({ ...body, candidateId: parseInt(candidateId) });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.candidateOtherDocument.findFirst({
    where: { id: parseInt(docId), candidateId: parseInt(candidateId) },
  });
  if (!existing) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (parsed.data.verificationStatus) {
    updateData.verificationStatus = parsed.data.verificationStatus;
    if (parsed.data.verificationStatus === 'Verified') updateData.verifiedAt = new Date();
  }
  if (parsed.data.remarks !== undefined) updateData.remarks = parsed.data.remarks;
  if (parsed.data.fileName !== undefined) updateData.fileName = parsed.data.fileName;
  if (parsed.data.filePath !== undefined) updateData.filePath = parsed.data.filePath;

  const record = await prisma.candidateOtherDocument.update({
    where: { id: parseInt(docId) },
    data: updateData,
    include,
  });

  await prisma.candidateActivityLog.create({
    data: {
      candidateId: parseInt(candidateId),
      action: `Other document ${parsed.data.verificationStatus} — ${record.otherDocType?.docName ?? ''}`,
      remarks: parsed.data.remarks ?? null,
    },
  });

  return NextResponse.json(record);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string; docId: string }> }
) {
  const { docId } = await params;
  await prisma.candidateOtherDocument.delete({ where: { id: parseInt(docId) } });
  return NextResponse.json({ message: 'Deleted' }, { status: 200 });
}
