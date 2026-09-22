import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { saveUploadedFile } from '@/lib/file-storage';
import { learningAuth, auditLearning, canAccessDocument } from '@/lib/learning/shared';

// GET /api/training-documents — document library (BRD §38).
export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const docType = searchParams.get('docType');
  const scheduleId = searchParams.get('trainingScheduleId');
  const programId = searchParams.get('trainingProgramId');
  const search = searchParams.get('search') ?? '';

  const data = await prisma.trainingDocument.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(docType ? { docType } : {}),
      ...(scheduleId ? { trainingScheduleId: parseInt(scheduleId) } : {}),
      ...(programId ? { trainingProgramId: parseInt(programId) } : {}),
      ...(search ? { title: { contains: search } } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  // §38: role-restricted documents are hidden from callers whose role isn't
  // listed (admins see everything).
  const visible = [] as typeof data;
  for (const doc of data) {
    if (await canAccessDocument(request, doc.accessRoles)) visible.push(doc);
  }

  return NextResponse.json({ data: visible });
}

// POST /api/training-documents — multipart upload: file + metadata fields.
export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });

  const file = form.get('file');
  const title = String(form.get('title') ?? '');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 });
  if (!title.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let filePath: string;
  try {
    filePath = await saveUploadedFile(buffer, `training/${companyId}`, file.name);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const num = (k: string) => {
    const v = form.get(k);
    return v ? parseInt(String(v)) : null;
  };

  const record = await prisma.trainingDocument.create({
    data: {
      companyId,
      title: title.trim(),
      docType: String(form.get('docType') ?? 'MATERIAL'),
      filePath,
      fileSize: buffer.length,
      mimeType: file.type || null,
      trainingScheduleId: num('trainingScheduleId'),
      trainingProgramId: num('trainingProgramId'),
      employeeId: num('employeeId'),
      uploadedByUserId: actor.userId,
      remarks: form.get('remarks') ? String(form.get('remarks')) : null,
      // §38: optional role restriction — normalized to a clean CSV string.
      accessRoles: (() => {
        const raw = String(form.get('accessRoles') ?? '');
        const roles = raw.split(',').map((r) => r.trim()).filter(Boolean);
        return roles.length ? roles.join(',') : null;
      })(),
    },
  });

  await auditLearning(companyId, actor, 'TrainingDocument', record.id, 'CREATE', null, record);
  return NextResponse.json(record, { status: 201 });
}
