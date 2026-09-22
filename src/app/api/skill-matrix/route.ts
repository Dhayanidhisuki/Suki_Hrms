import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { skillMatrixUpdateSchema } from '@/lib/validations/learning';
import { isLearningAdmin, resolveTnaIfGapClosed, auditLearning, callerEmployeeId } from '@/lib/learning/shared';
import type { PlatformActor } from '@/lib/platform/contracts';

export async function GET(request: NextRequest) {
  if (!request.headers.get('x-role-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') ?? 'employee';
  const employeeId = searchParams.get('employeeId');
  const departmentId = searchParams.get('departmentId');
  const designationId = searchParams.get('designationId'); // role-wise view (§31)
  const locationId = searchParams.get('locationId');       // location-wise view (§31)
  const competencyId = searchParams.get('competencyId');
  const gapStatus = searchParams.get('gapStatus');
  const search = searchParams.get('search') ?? '';
  const myTeam = searchParams.get('myTeam') === '1';

  const where: Record<string, unknown> = { companyId, deletedAt: null };
  if (employeeId) where.id = parseInt(employeeId);

  // §4/§30 "My Team" scope: only employees reporting to the caller.
  if (myTeam) {
    const actor: PlatformActor = {
      userId: Number(request.headers.get('x-user-id')) || null,
      employeeId: Number(request.headers.get('x-employee-id')) || null,
      source: 'user',
      ipAddress: null,
    };
    const callerEmpId = await callerEmployeeId(companyId, actor);
    where.reportingManagerId = callerEmpId ?? -1;
  }
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { employeeCode: { contains: search } },
    ];
  }

  const employees = await prisma.employee.findMany({
    where,
    include: {
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        include: { department: true, designation: true, grade: true },
      },
    },
    orderBy: { firstName: 'asc' },
  });

  const employeesWithJob = employees
    .map((emp) => {
      const job = emp.jobInfos[0] ?? null;
      if (departmentId && (!job || job.departmentId !== parseInt(departmentId))) return null;
      if (designationId && (!job || job.designationId !== parseInt(designationId))) return null;
      if (locationId && (!job || job.locationId !== parseInt(locationId))) return null;
      return { ...emp, job };
    })
    .filter(Boolean) as Array<typeof employees[number] & { job: typeof employees[number]['jobInfos'][0] | null }>;

  const employeeIds = employeesWithJob.map((e) => e.id);
  const departmentIds = employeesWithJob.map((e) => e.job?.departmentId).filter((id): id is number => !!id);
  const designationIds = employeesWithJob.map((e) => e.job?.designationId).filter((id): id is number => !!id);
  const gradeIds = employeesWithJob.map((e) => e.job?.gradeId).filter((id): id is number => typeof id === 'number');

  const jobTitles = employeesWithJob.map((e) => e.job?.jobTitle).filter((t): t is string => !!t);

  const reqWhere: Record<string, unknown> = {
    companyId,
    deletedAt: null,
    isActive: true,
    OR: [
      { departmentId: { in: Array.from(new Set(departmentIds.length ? departmentIds : [0])) } },
      { designationId: { in: Array.from(new Set(designationIds.length ? designationIds : [0])) } },
      { gradeId: { in: Array.from(new Set(gradeIds.length ? gradeIds : [0])) } },
      // §30: job-role-scoped requirements match on JobInfo.jobTitle.
      { jobRole: { in: Array.from(new Set(jobTitles.length ? jobTitles : ['∅'])) } },
    ],
  };
  if (competencyId) reqWhere.competencyId = parseInt(competencyId);

  const requirements = await prisma.competencyRequirement.findMany({
    where: reqWhere,
    include: { competency: true, requiredLevel: true },
  });

  // Skill requirements follow the same role-scope semantics (BRD §29–30).
  const skillReqWhere: Record<string, unknown> = { ...reqWhere };
  delete skillReqWhere.competencyId;
  const skillIdParam = searchParams.get('skillId');
  if (skillIdParam) skillReqWhere.skillId = parseInt(skillIdParam);
  const skillRequirements = await prisma.skillRequirement.findMany({
    where: skillReqWhere,
    include: { skill: true, requiredLevel: true },
  });

  const compIds = Array.from(new Set(requirements.map((r) => r.competencyId)));
  const skillIds = Array.from(new Set(skillRequirements.map((r) => r.skillId)));

  const [employeeCompetencies, employeeSkillLevels] = await Promise.all([
    compIds.length
      ? prisma.employeeCompetency.findMany({
          where: {
            companyId,
            deletedAt: null,
            employeeId: { in: employeeIds },
            competencyId: { in: compIds },
          },
          include: { currentLevel: true, targetLevel: true },
        })
      : [],
    skillIds.length
      ? prisma.employeeSkillLevel.findMany({
          where: {
            companyId,
            deletedAt: null,
            employeeId: { in: employeeIds },
            skillId: { in: skillIds },
          },
          include: { currentLevel: true, targetLevel: true },
        })
      : [],
  ]);

  const ecMap = new Map<string, typeof employeeCompetencies[number]>();
  for (const ec of employeeCompetencies) {
    ecMap.set(`${ec.employeeId}-${ec.competencyId}`, ec);
  }
  const esMap = new Map<string, typeof employeeSkillLevels[number]>();
  for (const es of employeeSkillLevels) {
    esMap.set(`${es.employeeId}-${es.skillId}`, es);
  }

  let rows = [] as {
    id: number;
    employeeId: number;
    employeeCode: string;
    employeeName: string;
    departmentName: string;
    designationName: string;
    gradeName: string;
    itemType: 'COMPETENCY' | 'SKILL';
    competencyId: number;
    competencyCode: string | null;
    competencyName: string;
    category: string;
    requiredLevelId: number;
    requiredLevelNumber: number;
    requiredLevelName: string;
    requiredColor: string | null;
    currentLevelId: number | null;
    currentLevelNumber: number;
    currentLevelName: string;
    currentColor: string | null;
    targetLevelId: number | null;
    targetLevelNumber: number | null;
    targetLevelName: string | null;
    gap: number;
    gapStatus: 'met' | 'open' | 'critical';
  }[];

  // §30: when several requirements match an employee (e.g. a department-wide
  // and a designation-specific row), the most specific one wins — otherwise
  // the same employee+item would appear multiple times with different
  // required levels.
  const specificity = (r: { departmentId: number | null; designationId: number | null; gradeId: number | null; jobRole: string | null }) =>
    (r.departmentId != null ? 1 : 0) + (r.designationId != null ? 2 : 0) + (r.gradeId != null ? 4 : 0) + (r.jobRole != null ? 8 : 0);
  const pickMostSpecific = <T extends { departmentId: number | null; designationId: number | null; gradeId: number | null; jobRole: string | null }>(
    reqs: T[],
    job: { departmentId: number | null; designationId: number | null; gradeId: number | null; jobTitle: string | null } | null,
    itemKey: keyof T,
  ): T[] => {
    const best = new Map<unknown, { req: T; score: number }>();
    for (const req of reqs) {
      if (req.departmentId != null && req.departmentId !== job?.departmentId) continue;
      if (req.designationId != null && req.designationId !== job?.designationId) continue;
      if (req.gradeId != null && req.gradeId !== job?.gradeId) continue;
      // §30: a jobRole-scoped requirement only matches that job title.
      if (req.jobRole != null && req.jobRole.trim().toLowerCase() !== (job?.jobTitle ?? '').trim().toLowerCase()) continue;
      const key = req[itemKey];
      const score = specificity(req);
      const cur = best.get(key);
      if (!cur || score > cur.score) best.set(key, { req, score });
    }
    return [...best.values()].map((b) => b.req);
  };

  for (const emp of employeesWithJob) {
    const fullName = [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ');
    const job = emp.job;
    for (const req of pickMostSpecific(requirements, job, 'competencyId')) {

      const ec = ecMap.get(`${emp.id}-${req.competencyId}`);
      const currentNumber = ec?.currentLevel?.levelNumber ?? 0;
      const currentName = ec?.currentLevel?.name ?? '—';
      const gap = req.requiredLevel.levelNumber - currentNumber;
      const gapStatus: 'met' | 'open' | 'critical' = gap <= 0 ? 'met' : gap === 1 ? 'open' : 'critical';

      rows.push({
        id: emp.id * 1_000_000 + req.competencyId,
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: fullName,
        departmentName: job?.department?.name ?? '—',
        designationName: job?.designation?.name ?? '—',
        gradeName: job?.grade?.name ?? '—',
        itemType: 'COMPETENCY',
        competencyId: req.competencyId,
        competencyCode: req.competency.code,
        competencyName: req.competency.name,
        category: req.competency.category,
        requiredLevelId: req.requiredLevel.id,
        requiredLevelNumber: req.requiredLevel.levelNumber,
        requiredLevelName: req.requiredLevel.name,
        requiredColor: req.requiredLevel.color,
        currentLevelId: ec?.currentLevel?.id ?? null,
        currentLevelNumber: currentNumber,
        currentLevelName: currentName,
        currentColor: ec?.currentLevel?.color ?? null,
        targetLevelId: ec?.targetLevel?.id ?? null,
        targetLevelNumber: ec?.targetLevel?.levelNumber ?? null,
        targetLevelName: ec?.targetLevel?.name ?? null,
        gap,
        gapStatus,
      });
    }

    // Skill requirements — same matching rules, itemType SKILL.
    for (const req of pickMostSpecific(skillRequirements, job, 'skillId')) {

      const es = esMap.get(`${emp.id}-${req.skillId}`);
      const currentNumber = es?.currentLevel?.levelNumber ?? 0;
      const currentName = es?.currentLevel?.name ?? '—';
      const gap = req.requiredLevel.levelNumber - currentNumber;
      const gapStatus: 'met' | 'open' | 'critical' = gap <= 0 ? 'met' : gap === 1 ? 'open' : 'critical';

      rows.push({
        id: emp.id * 2_000_000 + req.skillId,
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: fullName,
        departmentName: job?.department?.name ?? '—',
        designationName: job?.designation?.name ?? '—',
        gradeName: job?.grade?.name ?? '—',
        itemType: 'SKILL',
        competencyId: req.skillId,
        competencyCode: req.skill.code,
        competencyName: req.skill.name,
        category: req.skill.category ?? '—',
        requiredLevelId: req.requiredLevel.id,
        requiredLevelNumber: req.requiredLevel.levelNumber,
        requiredLevelName: req.requiredLevel.name,
        requiredColor: req.requiredLevel.color,
        currentLevelId: es?.currentLevel?.id ?? null,
        currentLevelNumber: currentNumber,
        currentLevelName: currentName,
        currentColor: es?.currentLevel?.color ?? null,
        targetLevelId: es?.targetLevel?.id ?? null,
        targetLevelNumber: es?.targetLevel?.levelNumber ?? null,
        targetLevelName: es?.targetLevel?.name ?? null,
        gap,
        gapStatus,
      });
    }
  }

  if (gapStatus) {
    rows = rows.filter((r) => r.gapStatus === gapStatus);
  }

  const sortKey =
    view === 'department' ? 'departmentName' :
    view === 'role' ? 'designationName' :
    view === 'skill' ? 'competencyName' :
    'employeeName';
  rows.sort((a, b) => (a as unknown as Record<string, string>)[sortKey].localeCompare((b as unknown as Record<string, string>)[sortKey]));

  const kpis = {
    employeesAssessed: new Set(rows.filter((r) => r.currentLevelId !== null).map((r) => r.employeeId)).size,
    skillsTracked: rows.length,
    openGaps: rows.filter((r) => r.gapStatus !== 'met').length,
    criticalGaps: rows.filter((r) => r.gapStatus === 'critical').length,
  };

  return NextResponse.json({ data: rows, kpis });
}

export async function POST(request: NextRequest) {
  if (!request.headers.get('x-role-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // §51: proficiency levels may only be set by authorized users (admin roles)
  // or through an approved assessment process.
  if (!(await isLearningAdmin(request))) {
    return NextResponse.json(
      { error: 'Only HR/Company Admin may update proficiency levels directly' },
      { status: 403 }
    );
  }

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const body = await request.json();
  const parsed = skillMatrixUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { employeeId, competencyId, itemType, currentLevelId, targetLevelId } = parsed.data;

  // SKILL rows target EmployeeSkillLevel; COMPETENCY rows target
  // EmployeeCompetency. The matrix reuses `competencyId` to carry either id,
  // so the item type must drive which master + record table is touched.
  const [employee, item, level] = await Promise.all([
    prisma.employee.findFirst({ where: { id: employeeId, companyId } }),
    itemType === 'SKILL'
      ? prisma.skill.findFirst({ where: { id: competencyId, companyId, deletedAt: null } })
      : prisma.competency.findFirst({ where: { id: competencyId, companyId, deletedAt: null } }),
    prisma.skillLevel.findFirst({ where: { id: currentLevelId, companyId, deletedAt: null } }),
  ]);
  if (!employee || !item || !level) {
    return NextResponse.json(
      { error: `Invalid employee, ${itemType === 'SKILL' ? 'skill' : 'competency'} or skill level` },
      { status: 400 }
    );
  }

  if (targetLevelId) {
    const target = await prisma.skillLevel.findFirst({ where: { id: targetLevelId, companyId, deletedAt: null } });
    if (!target) {
      return NextResponse.json({ error: 'Invalid target level' }, { status: 400 });
    }
  }

  const record =
    itemType === 'SKILL'
      ? await prisma.employeeSkillLevel.upsert({
          where: { companyId_employeeId_skillId: { companyId, employeeId, skillId: competencyId } },
          update: { currentLevelId, targetLevelId: targetLevelId ?? null },
          create: { companyId, employeeId, skillId: competencyId, currentLevelId, targetLevelId: targetLevelId ?? null },
        })
      : await prisma.employeeCompetency.upsert({
          where: { companyId_employeeId_competencyId: { companyId, employeeId, competencyId } },
          update: { currentLevelId, targetLevelId: targetLevelId ?? null },
          create: { companyId, employeeId, competencyId, currentLevelId, targetLevelId: targetLevelId ?? null },
        });

  // §52: closing the gap resolves open TNA requests (re-TNA loop).
  const resolved = await resolveTnaIfGapClosed(companyId, employeeId, itemType, competencyId);
  if (resolved > 0) {
    const actor = {
      userId: Number(request.headers.get('x-user-id')) || null,
      employeeId: Number(request.headers.get('x-employee-id')) || null,
      source: 'user' as const,
      ipAddress: request.headers.get('x-forwarded-for') ?? null,
    };
    await auditLearning(companyId, actor, 'TrainingNeedRequest', null, 'RESOLVE', null,
      { employeeId, competencyId, resolved },
      `Gap closed by level update — ${resolved} TNA request(s) resolved`);
  }

  return NextResponse.json(record, { status: 201 });
}
