/**
 * Candidate Documents API — list + upload (BRD §5.13).
 *
 * GET  /api/recruitment/candidates/:candidateId/documents
 * POST /api/recruitment/candidates/:candidateId/documents  — upload a document
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const include = {
  documentType: { select: { id: true, documentName: true, category: true } },
  verifiedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  const cid = parseInt(candidateId);
  const records = await prisma.candidateDocument.findMany({
    where: { candidateId: cid },
    include,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ data: records });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  const cid = parseInt(candidateId);

  const candidate = await prisma.candidate.findFirst({ where: { id: cid, deletedAt: null } });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  const form = await request.formData();
  const documentTypeId = Number(form.get('documentTypeId'));
  const file = form.get('file') as File | null;
  const remarks = (form.get('remarks') as string) ?? null;

  if (!documentTypeId) return NextResponse.json({ error: 'Document type is required' }, { status: 400 });
  if (!file) return NextResponse.json({ error: 'File is required' }, { status: 400 });

  const docType = await prisma.documentType.findUnique({ where: { id: documentTypeId } });
  if (!docType) return NextResponse.json({ error: 'Document type not found' }, { status: 404 });

  // Store file (using existing file-storage pattern — for now, store metadata only)
  // In production, this would use saveUploadedFile from '@/lib/file-storage'
  const fileName = file.name;
  const fileUrl = `/api/recruitment/candidates/${cid}/documents/file/${Date.now()}_${fileName}`;

  const record = await prisma.candidateDocument.create({
    data: {
      candidateId: cid,
      documentTypeId,
      fileUrl,
      fileName,
      status: 'Uploaded',
      remarks,
    },
    include,
  });

  return NextResponse.json(record, { status: 201 });
}
