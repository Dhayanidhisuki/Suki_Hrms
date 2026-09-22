import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { trainingNeedSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning, notifyLearning } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? '';
  const employeeId = searchParams.get('employeeId') ?? '';
  const source = searchParams.get('source') ?? '';
  const priority = searchParams.get('priority') ?? '';
  const tnaYear = searchParams.get('tnaYear') ?? '';
  const programId = searchParams.get('programId') ?? '';

  const where = {
    companyId,
    deletedAt: null,
    ...(search ? { reason: { contains: search } } : {}),
    ...(status ? { status } : {}),
    ...(employeeId ? { employeeId: parseInt(employeeId) } : {}),
    ...(source ? { source } : {}),
    ...(priority ? { priority } : {}),
    ...(tnaYear ? { tnaYear: parseInt(tnaYear) } : {}),
    ...(programId ? { trainingProgramId: parseInt(programId) } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.trainingNeedRequest.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.trainingNeedRequest.count({ where }),
  ]);

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = trainingNeedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.trainingNeedRequest.create({
    data: { ...parsed.data, companyId, currentStageOrder: 0 },
  });

  await auditLearning(companyId, actor, 'TrainingNeedRequest', record.id, 'CREATE', null, record, 'TNA request raised');
  notifyLearning(companyId, 'TNA_SUBMITTED', {
    moduleCode: 'TRDV',
    sourceEntityType: 'TrainingNeedRequest',
    sourceEntityId: record.id,
    subjectEmpId: record.employeeId,
    linkPath: `/learning/training-needs`,
    data: { Request: { Id: record.id, Source: record.source, Priority: record.priority } },
  });

  return NextResponse.json(record, { status: 201 });
}
