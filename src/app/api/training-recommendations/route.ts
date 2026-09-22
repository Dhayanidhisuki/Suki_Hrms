/**
 * GET /api/training-recommendations — recommendation engine (BRD §32–33).
 *
 * For an employee (or all employees), computes open competency/skill gaps
 * and matches them to active TrainingPrograms via program.competencyId /
 * program.skillId. Returns suggested programs ranked by gap size.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');

  const empWhere: Record<string, unknown> = { companyId, deletedAt: null, status: 'active' };
  if (employeeId) empWhere.id = parseInt(employeeId);

  const employees = await prisma.employee.findMany({
    where: empWhere,
    select: {
      id: true, employeeCode: true, firstName: true, lastName: true,
      jobInfos: { where: { effectiveTo: null }, take: 1, select: { departmentId: true, designationId: true, gradeId: true, jobTitle: true } },
    },
  });
  const empIds = employees.map((e) => e.id);
  const jobOf = new Map(employees.map((e) => [e.id, e.jobInfos[0] ?? null]));

  const [compReqs, skillReqs, compLevels, skillLevels, programs] = await Promise.all([
    prisma.competencyRequirement.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      include: { competency: { select: { id: true, name: true } }, requiredLevel: { select: { levelNumber: true } } },
    }),
    prisma.skillRequirement.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      include: { skill: { select: { id: true, name: true } }, requiredLevel: { select: { levelNumber: true } } },
    }),
    prisma.employeeCompetency.findMany({
      where: { companyId, deletedAt: null, employeeId: { in: empIds } },
      include: { currentLevel: { select: { levelNumber: true } } },
    }),
    prisma.employeeSkillLevel.findMany({
      where: { companyId, deletedAt: null, employeeId: { in: empIds } },
      include: { currentLevel: { select: { levelNumber: true } } },
    }),
    prisma.trainingProgram.findMany({
      where: { companyId, deletedAt: null, isActive: true, OR: [{ competencyId: { not: null } }, { skillId: { not: null } }] },
      select: { id: true, name: true, method: true, duration: true, durationUnit: true, estimatedCost: true, competencyId: true, skillId: true },
    }),
  ]);

  const compMap = new Map(compLevels.map((c) => [`${c.employeeId}-${c.competencyId}`, c.currentLevel?.levelNumber ?? 0]));
  const skillMap = new Map(skillLevels.map((s) => [`${s.employeeId}-${s.skillId}`, s.currentLevel?.levelNumber ?? 0]));

  const recommendations: {
    employeeId: number; employeeCode: string; employeeName: string;
    itemType: 'COMPETENCY' | 'SKILL' | 'CERT_EXPIRY' | 'RETRAINING' | 'MANDATORY' | 'CAREER_PATH'; itemId: number; itemName: string;
    source: 'GAP' | 'CERT_EXPIRY' | 'RETRAINING' | 'MANDATORY' | 'IDP';
    requiredLevel: number; currentLevel: number; gap: number;
    programs: { id: number; name: string; method: string | null; duration: number | null; estimatedCost: number | null }[];
  }[] = [];

  // Normalize competency + skill requirements into one shape for gap matching.
  const allReqs = [
    ...compReqs.map((r) => ({
      type: 'COMPETENCY' as const, itemId: r.competencyId, itemName: r.competency.name,
      departmentId: r.departmentId, designationId: r.designationId, gradeId: r.gradeId, jobRole: r.jobRole,
      requiredLevel: r.requiredLevel.levelNumber, levels: compMap,
    })),
    ...skillReqs.map((r) => ({
      type: 'SKILL' as const, itemId: r.skillId, itemName: r.skill.name,
      departmentId: r.departmentId, designationId: r.designationId, gradeId: r.gradeId, jobRole: r.jobRole,
      requiredLevel: r.requiredLevel.levelNumber, levels: skillMap,
    })),
  ];

  for (const emp of employees) {
    const job = jobOf.get(emp.id);
    const name = [emp.firstName, emp.lastName].filter(Boolean).join(' ');

    // §30: when several requirements match the same item (e.g. department-wide
    // + designation-specific), the most specific row wins.
    const best = new Map<string, { req: (typeof allReqs)[number]; score: number }>();
    for (const req of allReqs) {
      if (req.departmentId != null && req.departmentId !== job?.departmentId) continue;
      if (req.designationId != null && req.designationId !== job?.designationId) continue;
      if (req.gradeId != null && req.gradeId !== job?.gradeId) continue;
      // §30: a jobRole-scoped requirement only matches that job title.
      if (req.jobRole != null && req.jobRole.trim().toLowerCase() !== (job?.jobTitle ?? '').trim().toLowerCase()) continue;
      const score = (req.departmentId != null ? 1 : 0) + (req.designationId != null ? 2 : 0) + (req.gradeId != null ? 4 : 0) + (req.jobRole != null ? 8 : 0);
      const key = `${req.type}-${req.itemId}`;
      const cur = best.get(key);
      if (!cur || score > cur.score) best.set(key, { req, score });
    }

    for (const { req } of best.values()) {

      const current = req.levels.get(`${emp.id}-${req.itemId}`) ?? 0;
      const gap = req.requiredLevel - current;
      if (gap <= 0) continue;

      const matches = programs
        .filter((p) => (req.type === 'COMPETENCY' ? p.competencyId === req.itemId : p.skillId === req.itemId))
        .map((p) => ({
          id: p.id, name: p.name, method: p.method,
          duration: p.duration != null ? Number(p.duration) : null,
          estimatedCost: p.estimatedCost != null ? Number(p.estimatedCost) : null,
        }));

      recommendations.push({
        employeeId: emp.id, employeeCode: emp.employeeCode, employeeName: name,
        itemType: req.type, itemId: req.itemId, itemName: req.itemName,
        source: 'GAP',
        requiredLevel: req.requiredLevel, currentLevel: current, gap,
        programs: matches,
      });
    }
  }

  // ── §33 enrichment: certification expiry, retraining needs, mandatory ────
  const in60d = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  const [expiringCerts, histories, effectiveness, mandatoryPrograms, idps] = await Promise.all([
    prisma.trainingCertificate.findMany({
      where: { companyId, deletedAt: null, employeeId: { in: empIds }, expiryDate: { lte: in60d } },
      select: { employeeId: true, trainingProgramId: true, expiryDate: true, certificateNumber: true },
    }),
    prisma.trainingHistory.findMany({
      where: { companyId, deletedAt: null, employeeId: { in: empIds } },
      select: { employeeId: true, trainingProgramId: true, status: true },
    }),
    prisma.trainingEffectiveness.findMany({
      where: {
        companyId, deletedAt: null, employeeId: { in: empIds },
        OR: [{ effectivenessRating: 'POOR' }, { additionalTrainingRequired: true }],
      },
      select: { employeeId: true, trainingScheduleId: true },
    }),
    prisma.trainingProgram.findMany({
      where: { companyId, deletedAt: null, isActive: true, isMandatory: true },
      select: { id: true, name: true, method: true, duration: true, estimatedCost: true },
    }),
    // §33: career path input — active IDPs point at the program that closes
    // the employee's development goal (or a competency/skill target).
    prisma.individualDevelopmentPlan.findMany({
      where: { companyId, deletedAt: null, status: 'ACTIVE', employeeId: { in: empIds } },
      select: { employeeId: true, title: true, trainingProgramId: true, competencyId: true, skillId: true, targetLevelId: true, targetDate: true },
    }),
  ]);

  const schedPrograms = new Map(
    (await prisma.trainingSchedule.findMany({
      where: { companyId, id: { in: effectiveness.map((e) => e.trainingScheduleId) }, deletedAt: null },
      select: { id: true, trainingProgramId: true },
    })).map((s) => [s.id, s.trainingProgramId]),
  );
  const allPrograms = new Map<number, { id: number; name: string; method: string | null; duration: unknown; estimatedCost: unknown }>();
  for (const p of [...programs, ...mandatoryPrograms]) allPrograms.set(p.id, p);
  const progLite = (id: number | null) => {
    const p = id != null ? allPrograms.get(id) : undefined;
    return p ? [{ id: p.id, name: p.name, method: p.method ?? null, duration: p.duration != null ? Number(p.duration) : null, estimatedCost: p.estimatedCost != null ? Number(p.estimatedCost) : null }] : [];
  };

  for (const emp of employees) {
    const name = [emp.firstName, emp.lastName].filter(Boolean).join(' ');

    // Certification expiring within 60 days → refresher program for the same training.
    for (const cert of expiringCerts.filter((c) => c.employeeId === emp.id)) {
      recommendations.push({
        employeeId: emp.id, employeeCode: emp.employeeCode, employeeName: name,
        itemType: 'CERT_EXPIRY', itemId: cert.trainingProgramId ?? 0,
        itemName: `Certificate ${cert.certificateNumber} expiring ${cert.expiryDate?.toISOString().slice(0, 10) ?? 'soon'}`,
        source: 'CERT_EXPIRY', requiredLevel: 0, currentLevel: 0, gap: 0,
        programs: progLite(cert.trainingProgramId),
      });
    }

    // Poor effectiveness / "additional training required" → retraining.
    const empHistoryPrograms = new Set(histories.filter((h) => h.employeeId === emp.id).map((h) => h.trainingProgramId));
    for (const eff of effectiveness.filter((e) => e.employeeId === emp.id)) {
      const pid = schedPrograms.get(eff.trainingScheduleId) ?? null;
      if (!pid) continue;
      recommendations.push({
        employeeId: emp.id, employeeCode: emp.employeeCode, employeeName: name,
        itemType: 'RETRAINING', itemId: pid,
        itemName: `Retraining: ${allPrograms.get(pid)?.name ?? `Program #${pid}`}`,
        source: 'RETRAINING', requiredLevel: 0, currentLevel: 0, gap: 0,
        programs: progLite(pid),
      });
    }

    // Mandatory programs never completed → recommend.
    for (const mp of mandatoryPrograms) {
      if (empHistoryPrograms.has(mp.id)) continue;
      recommendations.push({
        employeeId: emp.id, employeeCode: emp.employeeCode, employeeName: name,
        itemType: 'MANDATORY', itemId: mp.id,
        itemName: `Mandatory: ${mp.name}`,
        source: 'MANDATORY', requiredLevel: 0, currentLevel: 0, gap: 0,
        programs: progLite(mp.id),
      });
    }

    // §33 career path input: active IDPs — the IDP's own trainingProgramId
    // when set, otherwise programs linked to the IDP's competency/skill goal.
    for (const idp of idps.filter((i) => i.employeeId === emp.id)) {
      let progs = idp.trainingProgramId ? progLite(idp.trainingProgramId) : [];
      if (progs.length === 0 && (idp.competencyId || idp.skillId)) {
        progs = programs
          .filter((p) => (idp.competencyId ? p.competencyId === idp.competencyId : p.skillId === idp.skillId))
          .map((p) => ({ id: p.id, name: p.name, method: p.method, duration: p.duration != null ? Number(p.duration) : null, estimatedCost: p.estimatedCost != null ? Number(p.estimatedCost) : null }));
      }
      if (progs.length === 0) continue;
      recommendations.push({
        employeeId: emp.id, employeeCode: emp.employeeCode, employeeName: name,
        itemType: 'CAREER_PATH', itemId: idp.trainingProgramId ?? idp.competencyId ?? idp.skillId ?? 0,
        itemName: `Career path: ${idp.title}`,
        source: 'IDP', requiredLevel: 0, currentLevel: 0, gap: 0,
        programs: progs,
      });
    }
    // Note: a performance-appraisal table does not exist in this deployment —
    // appraisal-driven recommendations plug in here when one is added. The
    // engine is defensive and skips the input when no data exists.
  }

  recommendations.sort((a, b) => b.gap - a.gap);
  return NextResponse.json({ data: recommendations });
}
