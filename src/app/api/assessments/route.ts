import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assessmentSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const scheduleId = searchParams.get('scheduleId') ?? '';
  const programId = searchParams.get('programId') ?? '';
  const assessmentType = searchParams.get('assessmentType') ?? '';
  const status = searchParams.get('status') ?? '';

  const where = {
    companyId,
    deletedAt: null,
    ...(scheduleId ? { trainingScheduleId: parseInt(scheduleId) } : {}),
    ...(programId ? { trainingProgramId: parseInt(programId) } : {}),
    ...(assessmentType ? { assessmentType } : {}),
    ...(status ? { status } : {}),
  };

  const data = await prisma.assessment.findMany({ where, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = assessmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.assessment.create({
    data: { ...parsed.data, companyId },
  });

  await auditLearning(companyId, actor, 'Assessment', record.id, 'CREATE', null, record);
  return NextResponse.json(record, { status: 201 });
}
