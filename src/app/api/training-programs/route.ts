import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { trainingProgramSchema } from '@/lib/validations/learning';
import { nextSequentialCode } from '@/lib/master-code';
import { auditLearning } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  if (!request.headers.get('x-role-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const { searchParams } = new URL(request.url);
  const full = searchParams.get('full') === '1';
  const category = searchParams.get('category') ?? '';
  const method = searchParams.get('method') ?? '';
  const type = searchParams.get('type') ?? '';
  const isMandatory = searchParams.get('isMandatory') ?? '';
  const competencyId = searchParams.get('competencyId') ?? '';
  const skillId = searchParams.get('skillId') ?? '';
  const search = searchParams.get('search') ?? '';

  const programs = await prisma.trainingProgram.findMany({
    where: {
      companyId,
      deletedAt: null,
      isActive: true,
      ...(category ? { category } : {}),
      ...(method ? { method } : {}),
      ...(type ? { type } : {}),
      ...(isMandatory ? { isMandatory: isMandatory === '1' || isMandatory === 'true' } : {}),
      ...(competencyId ? { competencyId: parseInt(competencyId) } : {}),
      ...(skillId ? { skillId: parseInt(skillId) } : {}),
      ...(search ? { OR: [{ name: { contains: search } }, { code: { contains: search } }] } : {}),
    },
    orderBy: { name: 'asc' },
    select: full
      ? undefined
      : { id: true, code: true, name: true, category: true },
  });

  return NextResponse.json(programs);
}

export async function POST(request: NextRequest) {
  if (!request.headers.get('x-role-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;
  const actor = {
    userId: Number(request.headers.get('x-user-id')) || null,
    employeeId: null,
    source: 'user' as const,
    ipAddress: request.headers.get('x-forwarded-for') ?? null,
  };

  const body = await request.json();
  const parsed = trainingProgramSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Auto-generate TPR### code (same pattern as CMP### for competencies) —
  // any client-supplied code is ignored.
  const existing = await prisma.trainingProgram.findMany({
    where: { companyId },
    select: { code: true },
  });
  const code = nextSequentialCode(existing.map((r) => r.code).filter((c): c is string => c != null), 'TPR', 3);

  const record = await prisma.trainingProgram.create({
    data: { ...parsed.data, code, companyId },
  });

  await auditLearning(companyId, actor, 'TrainingProgram', record.id, 'CREATE', null, record);
  return NextResponse.json(record, { status: 201 });
}
