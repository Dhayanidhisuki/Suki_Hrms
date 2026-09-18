/**
 * Candidate Other Documents API (BRD §7.8).
 * Lists and creates "Other Joining Documents" for a candidate.
 * On push-to-employee, these are copied to EmployeeDocument.
 *
 * GET  /api/recruitment/candidates/[candidateId]/other-documents
 * POST /api/recruitment/candidates/[candidateId]/other-documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { candidateOtherDocumentSchema } from '@/lib/validations/recruitment';

const include = {
  otherDocType: { select: { id: true, docCode: true, docName: true, mandatory: true } },
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  const { candidateId } = await params;
  const records = await prisma.candidateOtherDocument.findMany({
    where: { candidateId: parseInt(candidateId) },
    include,
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ data: records });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  const { candidateId } = await params;
  const body = await request.json();
  const parsed = candidateOtherDocumentSchema.safeParse({ ...body, candidateId: parseInt(candidateId) });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const candidate = await prisma.candidate.findFirst({ where: { id: parsed.data.candidateId, deletedAt: null } });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  const docType = await prisma.otherJoiningDocType.findUnique({ where: { id: parsed.data.otherDocTypeId } });
  if (!docType) return NextResponse.json({ error: 'Document type not found' }, { status: 404 });

  const record = await prisma.candidateOtherDocument.create({
    data: {
      candidateId: parsed.data.candidateId,
      otherDocTypeId: parsed.data.otherDocTypeId,
      documentName: parsed.data.documentName,
      fileName: parsed.data.fileName ?? null,
      filePath: parsed.data.filePath ?? null,
      verificationStatus: parsed.data.verificationStatus ?? 'Pending',
      remarks: parsed.data.remarks ?? null,
    },
    include,
  });

  await prisma.candidateActivityLog.create({
    data: {
      candidateId: parsed.data.candidateId,
      action: `Other document uploaded — ${docType.docName}`,
      remarks: parsed.data.remarks ?? null,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
