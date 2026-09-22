import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { employeeSkillLevelSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning, isLearningAdmin } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId') ?? '';
  const skillId = searchParams.get('skillId') ?? '';

  const data = await prisma.employeeSkillLevel.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(employeeId ? { employeeId: parseInt(employeeId) } : {}),
      ...(skillId ? { skillId: parseInt(skillId) } : {}),
    },
    include: {
      skill: { select: { id: true, code: true, name: true, category: true } },
      currentLevel: { select: { id: true, levelNumber: true, name: true } },
      targetLevel: { select: { id: true, levelNumber: true, name: true } },
    },
  });

  return NextResponse.json({ data });
}

// §51: proficiency levels may only be set by authorized users.
export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  if (!(await isLearningAdmin(request))) {
    return NextResponse.json({ error: 'Only HR/Company Admin may update skill proficiency' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = employeeSkillLevelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { employeeId, skillId, currentLevelId, targetLevelId } = parsed.data;

  const [employee, skill, level] = await Promise.all([
    prisma.employee.findFirst({ where: { id: employeeId, companyId } }),
    prisma.skill.findFirst({ where: { id: skillId, companyId, deletedAt: null } }),
    prisma.skillLevel.findFirst({ where: { id: currentLevelId, companyId, deletedAt: null } }),
  ]);
  if (!employee || !skill || !level) {
    return NextResponse.json({ error: 'Invalid employee, skill or level' }, { status: 400 });
  }

  const record = await prisma.employeeSkillLevel.upsert({
    where: { companyId_employeeId_skillId: { companyId, employeeId, skillId } },
    update: { currentLevelId, targetLevelId: targetLevelId ?? null },
    create: { companyId, employeeId, skillId, currentLevelId, targetLevelId: targetLevelId ?? null },
  });

  await auditLearning(companyId, actor, 'EmployeeSkillLevel', record.id, 'UPSERT', null, record, `Skill level set to ${currentLevelId}`);
  return NextResponse.json(record, { status: 201 });
}
