/**
 * Portal Documents API (BRD §10.6).
 * Candidate uploads documents from the portal (token-based).
 *
 * GET  /api/portal/documents?t=<token> — list candidate's documents
 * POST /api/portal/documents?t=<token> — candidate uploads a document
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { portalDocumentUploadSchema } from '@/lib/validations/recruitment';

async function verifyToken(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('t');
  if (!token) return null;
  const record = await prisma.candidatePortalToken.findUnique({ where: { token } });
  if (!record || record.revokedAt || record.expiresAt < new Date()) return null;
  await prisma.candidatePortalToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return record.candidateId;
}

export async function GET(request: NextRequest) {
  const candidateId = await verifyToken(request);
  if (!candidateId) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const documents = await prisma.candidateDocument.findMany({
    where: { candidateId },
    include: { documentType: { select: { documentName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ data: documents });
}

export async function POST(request: NextRequest) {
  const candidateId = await verifyToken(request);
  if (!candidateId) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  const body = await request.json();
  const parsed = portalDocumentUploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Find a "Candidate Uploaded" document type, or create one if missing
  let docType = await prisma.documentType.findFirst({ where: { documentName: 'Candidate Uploaded' } });
  if (!docType) {
    docType = await prisma.documentType.create({ data: { documentName: 'Candidate Uploaded', documentCode: 'CAND_UP', category: 'Other' } });
  }

  const document = await prisma.candidateDocument.create({
    data: {
      candidateId,
      documentTypeId: docType.id,
      fileName: parsed.data.documentName,
      fileUrl: parsed.data.filePath ?? null,
      status: 'Pending',
      remarks: parsed.data.remarks ?? null,
    },
  });

  await prisma.candidateActivityLog.create({
    data: {
      candidateId,
      action: `Document uploaded via portal — ${parsed.data.documentName}`,
    },
  });

  return NextResponse.json(document, { status: 201 });
}
