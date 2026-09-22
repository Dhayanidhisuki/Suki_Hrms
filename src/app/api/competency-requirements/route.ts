import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { competencyRequirementSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const competencyId = searchParams.get('competencyId') ?? '';
  const jobRole = searchParams.get('jobRole') ?? '';

  const data = await prisma.competencyRequirement.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(competencyId ? { competencyId: parseInt(competencyId) } : {}),
      ...(jobRole ? { jobRole } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      competency: { select: { id: true, code: true, name: true } },
      requiredLevel: { select: { id: true, levelNumber: true, name: true } },
    },
  });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = competencyRequirementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const [competency, level] = await Promise.all([
    prisma.competency.findFirst({ where: { id: parsed.data.competencyId, companyId, deletedAt: null } }),
    prisma.skillLevel.findFirst({ where: { id: parsed.data.requiredLevelId, companyId, deletedAt: null } }),
  ]);
  if (!competency || !level) {
    return NextResponse.json({ error: 'Invalid competency or skill level' }, { status: 400 });
  }

  // One requirement per (competency, dept, designation, grade, jobRole) combo.
  const dup = await prisma.competencyRequirement.findFirst({
    where: {
      companyId,
      competencyId: parsed.data.competencyId,
      departmentId: parsed.data.departmentId ?? null,
      designationId: parsed.data.designationId ?? null,
      gradeId: parsed.data.gradeId ?? null,
      jobRole: parsed.data.jobRole ?? null,
      deletedAt: null,
    },
  });
  if (dup) {
    return NextResponse.json({ error: 'Requirement already exists for this competency + role combination' }, { status: 409 });
  }

  const record = await prisma.competencyRequirement.create({
    data: { ...parsed.data, companyId },
  });

  await auditLearning(companyId, actor, 'CompetencyRequirement', record.id, 'CREATE', null, record);
  return NextResponse.json(record, { status: 201 });
}
