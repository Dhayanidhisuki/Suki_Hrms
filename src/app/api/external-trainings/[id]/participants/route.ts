import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { externalParticipantUpdateSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning } from '@/lib/learning/shared';

// §35: real participant records on an external training — replaces the loose
// employeeIds CSV for new flows (CSV is kept in sync for display/legacy).
async function syncEmployeeIdsCsv(companyId: number, externalTrainingId: number) {
  const rows = await prisma.externalTrainingParticipant.findMany({
    where: { companyId, externalTrainingId, deletedAt: null, status: { not: 'CANCELLED' } },
    select: { employeeId: true },
  });
  await prisma.externalTraining.update({
    where: { id: externalTrainingId },
    data: { employeeIds: JSON.stringify(rows.map((r) => r.employeeId)) },
  });
}

async function getTraining(companyId: number, id: number) {
  return prisma.externalTraining.findFirst({ where: { id, companyId, deletedAt: null } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;
  const { id } = await params;

  const training = await getTraining(companyId, parseInt(id));
  if (!training) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data = await prisma.externalTrainingParticipant.findMany({
    where: { companyId, externalTrainingId: training.id, deletedAt: null },
    orderBy: { id: 'asc' },
  });
  return NextResponse.json({ data });
}

// POST { employeeId } | { employeeIds: number[] } — nominate participants.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const trainingId = parseInt(id);

  const training = await getTraining(companyId, trainingId);
  if (!training) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const employeeIds: number[] = Array.isArray(body?.employeeIds)
    ? body.employeeIds.map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
    : body?.employeeId
      ? [Number(body.employeeId)]
      : [];
  if (employeeIds.length === 0) {
    return NextResponse.json({ error: 'employeeId or employeeIds is required' }, { status: 400 });
  }

  const created: number[] = [];
  const skipped: number[] = [];
  for (const employeeId of employeeIds) {
    const existing = await prisma.externalTrainingParticipant.findFirst({
      where: { companyId, externalTrainingId: trainingId, employeeId, deletedAt: null },
    });
    if (existing) { skipped.push(employeeId); continue; }
    const row = await prisma.externalTrainingParticipant.create({
      data: { companyId, externalTrainingId: trainingId, employeeId },
    });
    created.push(row.id);
    await auditLearning(companyId, actor, 'ExternalTrainingParticipant', row.id, 'CREATE', null, row);
  }

  await syncEmployeeIdsCsv(companyId, trainingId);
  return NextResponse.json({ created, skipped }, { status: 201 });
}

// PATCH { participantId, ...fields } — completion status, certificate link,
// feedback rating/comments, effectiveness rating.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const trainingId = parseInt(id);

  const training = await getTraining(companyId, trainingId);
  if (!training) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const participantId = Number(body?.participantId);
  if (!Number.isInteger(participantId) || participantId <= 0) {
    return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
  }
  const parsed = externalParticipantUpdateSchema.safeParse({ ...body, externalTrainingId: trainingId });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.externalTrainingParticipant.findFirst({
    where: { id: participantId, companyId, externalTrainingId: trainingId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Participant not found' }, { status: 404 });

  const updates: Record<string, unknown> = {};
  for (const key of ['status', 'certificateId', 'feedbackRating', 'feedbackComments', 'effectivenessRating'] as const) {
    if (parsed.data[key] !== undefined) updates[key] = parsed.data[key];
  }
  const record = await prisma.externalTrainingParticipant.update({
    where: { id: participantId },
    data: updates,
  });
  await auditLearning(companyId, actor, 'ExternalTrainingParticipant', participantId, 'UPDATE', existing, record);

  // Keep the certificateIssued flag on the parent in sync.
  if (record.certificateId && !training.certificateIssued) {
    await prisma.externalTraining.update({ where: { id: trainingId }, data: { certificateIssued: true } });
  }
  await syncEmployeeIdsCsv(companyId, trainingId);
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const trainingId = parseInt(id);

  const training = await getTraining(companyId, trainingId);
  if (!training) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const participantId = parseInt(searchParams.get('participantId') ?? '');
  if (!Number.isInteger(participantId)) {
    return NextResponse.json({ error: 'participantId query param is required' }, { status: 400 });
  }
  const existing = await prisma.externalTrainingParticipant.findFirst({
    where: { id: participantId, companyId, externalTrainingId: trainingId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Participant not found' }, { status: 404 });

  await prisma.externalTrainingParticipant.update({
    where: { id: participantId },
    data: { deletedAt: new Date(), isActive: false },
  });
  await auditLearning(companyId, actor, 'ExternalTrainingParticipant', participantId, 'DELETE', existing, null);
  await syncEmployeeIdsCsv(companyId, trainingId);
  return NextResponse.json({ message: 'Removed' });
}
