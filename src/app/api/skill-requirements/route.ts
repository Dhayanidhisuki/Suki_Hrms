import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { skillRequirementSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const skillId = searchParams.get('skillId') ?? '';
  const jobRole = searchParams.get('jobRole') ?? '';

  const data = await prisma.skillRequirement.findMany({
    where: { companyId, deletedAt: null, ...(skillId ? { skillId: parseInt(skillId) } : {}), ...(jobRole ? { jobRole } : {}) },
    orderBy: { createdAt: 'desc' },
    include: {
      skill: { select: { id: true, code: true, name: true } },
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
  const parsed = skillRequirementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const [skill, level] = await Promise.all([
    prisma.skill.findFirst({ where: { id: parsed.data.skillId, companyId, deletedAt: null } }),
    prisma.skillLevel.findFirst({ where: { id: parsed.data.requiredLevelId, companyId, deletedAt: null } }),
  ]);
  if (!skill || !level) {
    return NextResponse.json({ error: 'Invalid skill or skill level' }, { status: 400 });
  }

  const dup = await prisma.skillRequirement.findFirst({
    where: {
      companyId,
      skillId: parsed.data.skillId,
      departmentId: parsed.data.departmentId ?? null,
      designationId: parsed.data.designationId ?? null,
      gradeId: parsed.data.gradeId ?? null,
      jobRole: parsed.data.jobRole ?? null,
      deletedAt: null,
    },
  });
  if (dup) {
    return NextResponse.json({ error: 'Requirement already exists for this skill + role combination' }, { status: 409 });
  }

  const record = await prisma.skillRequirement.create({ data: { ...parsed.data, companyId } });
  await auditLearning(companyId, actor, 'SkillRequirement', record.id, 'CREATE', null, record);
  return NextResponse.json(record, { status: 201 });
}
