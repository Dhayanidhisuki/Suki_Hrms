import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readStoredFile } from '@/lib/file-storage';
import { learningAuth, auditLearning, canAccessDocument } from '@/lib/learning/shared';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;
  const { id } = await params;

  const record = await prisma.trainingDocument.findFirst({
    where: { id: parseInt(id), companyId, deletedAt: null },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // §38: role-restricted documents deny both metadata and download.
  if (!(await canAccessDocument(request, record.accessRoles))) {
    return NextResponse.json({ error: 'You do not have access to this document' }, { status: 403 });
  }

  // ?download=1 streams the file; otherwise returns metadata.
  if (new URL(request.url).searchParams.get('download')) {
    try {
      const buf = await readStoredFile(record.filePath);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': record.mimeType ?? 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${record.title.replace(/"/g, '')}"`,
        },
      });
    } catch {
      return NextResponse.json({ error: 'File missing on disk' }, { status: 404 });
    }
  }
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.trainingDocument.findFirst({
    where: { id: numericId, companyId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const record = await prisma.trainingDocument.update({
    where: { id: numericId },
    data: { deletedAt: new Date(), isActive: false },
  });
  await auditLearning(companyId, actor, 'TrainingDocument', numericId, 'DELETE', existing, record);
  return NextResponse.json({ message: 'Deleted' });
}
