/**
 * Candidate Document [id] — verify / reject / re-upload (BRD §5.13).
 *
 * PATCH /api/recruitment/candidates/:candidateId/documents/:docId
 *   { status: 'Verified' | 'Rejected' | 'Re-upload', remarks?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { candidateDocumentVerifySchema } from '@/lib/validations/recruitment';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string; docId: string }> }
) {
  const { candidateId, docId } = await params;
  const cid = parseInt(candidateId);
  const did = parseInt(docId);

  const body = await request.json();
  const parsed = candidateDocumentVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.candidateDocument.findFirst({ where: { id: did, candidateId: cid } });
  if (!existing) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  // Get verifier from header (in production, from auth context)
  const roleId = request.headers.get('x-role-id');
  const verifierEmployeeId = roleId ? null : null; // TODO: resolve from auth

  const record = await prisma.candidateDocument.update({
    where: { id: did },
    data: {
      status: parsed.data.status,
      remarks: parsed.data.remarks ?? existing.remarks,
      verifiedAt: parsed.data.status === 'Verified' ? new Date() : null,
    },
    include: {
      documentType: { select: { id: true, documentName: true, category: true } },
      verifiedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Log activity
  await prisma.candidateActivityLog.create({
    data: {
      candidateId: cid,
      action: `Document ${parsed.data.status} — ${record.documentType?.documentName ?? ''}`,
      remarks: parsed.data.remarks ?? null,
    },
  });

  return NextResponse.json(record);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string; docId: string }> }
) {
  const { candidateId, docId } = await params;
  await prisma.candidateDocument.delete({
    where: { id: parseInt(docId) },
  });
  return NextResponse.json({ message: 'Deleted' }, { status: 200 });
}
