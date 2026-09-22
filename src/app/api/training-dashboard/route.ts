/**
 * GET /api/training-dashboard — aggregate KPIs for the Training Dashboard
 * (BRD §6). One endpoint that fans out into a handful of counts/sums so the
 * page loads in a single request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const year = String(now.getFullYear());

  const [
    tnaPending,
    nominationsPending,
    schedulesUpcoming,
    schedulesCompletedThisMonth,
    plansApproved,
    plansDraft,
    competencyGaps,
    feedbackPending,
    programs,
    trainers,
    venues,
    hoursThisMonthAgg,
    costYtdAgg,
    budgetAgg,
    mandatoryPending,
    avgAssessmentAgg,
    avgImprovementAgg,
    certificatesIssued,
    monthlySchedules,
    nominationsByStatus,
    effectivenessByRating,
    attendanceByStatus,
    assessmentResults,
  ] = await Promise.all([
    prisma.trainingNeedRequest.count({ where: { companyId, deletedAt: null, status: { in: ['DRAFT', 'SUBMITTED'] } } }),
    prisma.trainingNomination.count({ where: { companyId, deletedAt: null, status: 'PENDING' } }),
    prisma.trainingSchedule.count({ where: { companyId, deletedAt: null, status: 'SCHEDULED', scheduledDate: { gte: now } } }),
    prisma.trainingSchedule.count({ where: { companyId, deletedAt: null, status: 'COMPLETED', updatedAt: { gte: monthStart } } }),
    prisma.trainingPlan.count({ where: { companyId, deletedAt: null, status: 'APPROVED' } }),
    prisma.trainingPlan.count({ where: { companyId, deletedAt: null, status: 'DRAFT' } }),
    prisma.employeeCompetency.count({ where: { companyId, deletedAt: null } }),
    prisma.trainingSchedule.count({
      where: {
        companyId, deletedAt: null, status: 'COMPLETED',
        feedbacks: { none: { deletedAt: null } },
      },
    }),
    prisma.trainingProgram.count({ where: { companyId, deletedAt: null, isActive: true } }),
    prisma.trainer.count({ where: { companyId, deletedAt: null, isActive: true } }),
    prisma.trainingVenue.count({ where: { companyId, deletedAt: null, isActive: true } }),
    // §42: training hours delivered this month.
    prisma.trainingSchedule.aggregate({
      _sum: { duration: true },
      where: { companyId, deletedAt: null, status: 'COMPLETED', updatedAt: { gte: monthStart } },
    }),
    // §42: estimated spend year-to-date (completed schedules' program cost).
    prisma.trainingSchedule.findMany({
      where: { companyId, deletedAt: null, status: 'COMPLETED', updatedAt: { gte: yearStart } },
      select: { trainingProgram: { select: { estimatedCost: true } } },
    }),
    // §42: budget utilization for the current year.
    prisma.trainingBudget.aggregate({
      _sum: { allocatedAmount: true, approvedAmount: true, utilizedAmount: true },
      where: { companyId, deletedAt: null, isActive: true, year },
    }),
    // §42: mandatory trainings not yet completed.
    prisma.trainingNomination.count({
      where: { companyId, deletedAt: null, reason: 'MANDATORY', status: { in: ['PENDING', 'NOMINATED', 'APPROVED'] } },
    }),
    prisma.assessmentAttempt.aggregate({
      _avg: { scorePercent: true },
      where: { companyId, deletedAt: null, submittedAt: { not: null } },
    }),
    prisma.trainingEffectiveness.aggregate({
      _avg: { scoreImprovement: true },
      where: { companyId, deletedAt: null, scoreImprovement: { not: null } },
    }),
    prisma.trainingCertificate.count({ where: { companyId, deletedAt: null } }),
    // Chart series — last 6 months of schedules.
    prisma.trainingSchedule.findMany({
      where: { companyId, deletedAt: null, scheduledDate: { gte: sixMonthsAgo } },
      select: { scheduledDate: true, status: true, duration: true, targetDepartmentId: true, trainingProgram: { select: { category: true, estimatedCost: true } } },
    }),
    prisma.trainingNomination.groupBy({ by: ['status'], _count: true, where: { companyId, deletedAt: null } }),
    prisma.trainingEffectiveness.groupBy({ by: ['effectivenessRating'], _count: true, where: { companyId, deletedAt: null, effectivenessRating: { not: null } } }),
    prisma.trainingAttendance.groupBy({ by: ['status'], _count: true, where: { companyId, deletedAt: null } }),
    prisma.assessmentAttempt.groupBy({ by: ['result'], _count: true, where: { companyId, deletedAt: null, submittedAt: { not: null } } }),
  ]);

  // ── Phase 13: additional §6/§42 series + KPI inputs (all additive) ──────────
  const [
    schedulesForDim,
    nomsForMandatory,
    attemptsForPrePost,
    empSkillLevels,
    empCompetencies,
    compReqs,
    skillReqs,
    employeesForGap,
    completedSchedulesAll,
    plannedSchedulesAll,
    nominatedTotal,
    attendedTotal,
    eligibleEmployees,
    effectivenessForTrend,
  ] = await Promise.all([
    // Department / category / cost dimension sources.
    prisma.trainingSchedule.findMany({
      where: { companyId, deletedAt: null, scheduledDate: { gte: yearStart } },
      select: { targetDepartmentId: true, status: true, trainingProgram: { select: { category: true } } },
    }),
    prisma.trainingNomination.findMany({
      where: { companyId, deletedAt: null },
      select: { reason: true },
    }),
    // Pre vs post average score.
    prisma.assessmentAttempt.findMany({
      where: { companyId, deletedAt: null, submittedAt: { not: null } },
      select: { scorePercent: true, assessment: { select: { assessmentType: true } } },
    }),
    // Skill proficiency distribution + gap computation source.
    prisma.employeeSkillLevel.findMany({
      where: { companyId, deletedAt: null },
      select: { employeeId: true, skillId: true, currentLevel: { select: { levelNumber: true, name: true } } },
    }),
    prisma.employeeCompetency.findMany({
      where: { companyId, deletedAt: null },
      select: { employeeId: true, competencyId: true, currentLevel: { select: { levelNumber: true } } },
    }),
    prisma.competencyRequirement.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      select: { competencyId: true, departmentId: true, designationId: true, gradeId: true, jobRole: true, requiredLevel: { select: { levelNumber: true } } },
    }),
    prisma.skillRequirement.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      select: { skillId: true, departmentId: true, designationId: true, gradeId: true, jobRole: true, requiredLevel: { select: { levelNumber: true } } },
    }),
    prisma.employee.findMany({
      where: { companyId, deletedAt: null, status: 'active' },
      select: { id: true, jobInfos: { where: { effectiveTo: null }, take: 1, select: { departmentId: true, designationId: true, gradeId: true, jobTitle: true } } },
    }),
    // §42 KPI inputs.
    prisma.trainingSchedule.count({ where: { companyId, deletedAt: null, status: 'COMPLETED' } }),
    prisma.trainingSchedule.count({ where: { companyId, deletedAt: null, status: { in: ['SCHEDULED', 'COMPLETED'] } } }),
    prisma.trainingNomination.count({ where: { companyId, deletedAt: null, status: 'APPROVED' } }),
    prisma.trainingAttendance.count({ where: { companyId, deletedAt: null, status: { in: ['PRESENT', 'LATE'] } } }),
    prisma.employee.count({ where: { companyId, deletedAt: null, status: 'active' } }),
    prisma.trainingEffectiveness.findMany({
      where: { companyId, deletedAt: null, scoreImprovement: { not: null } },
      select: { scoreImprovement: true, evaluationStage: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Upcoming 7-day schedule feed for the dashboard table.
  const upcomingList = await prisma.trainingSchedule.findMany({
    where: { companyId, deletedAt: null, status: 'SCHEDULED', scheduledDate: { gte: now } },
    orderBy: { scheduledDate: 'asc' },
    take: 10,
    include: {
      trainingProgram: { select: { name: true } },
      nominations: { where: { deletedAt: null }, select: { id: true } },
    },
  });

  // Monthly buckets: scheduled vs completed counts + hours delivered + cost.
  const months: { month: string; scheduled: number; completed: number; hours: number; cost: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.toLocaleString('en', { month: 'short' }), scheduled: 0, completed: 0, hours: 0, cost: 0 });
  }
  for (const s of monthlySchedules) {
    if (!s.scheduledDate) continue;
    const idx = months.findIndex((m, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return s.scheduledDate!.getFullYear() === d.getFullYear() && s.scheduledDate!.getMonth() === d.getMonth();
    });
    if (idx < 0) continue;
    months[idx].scheduled++;
    if (s.status === 'COMPLETED') {
      months[idx].completed++;
      months[idx].hours += Number(s.duration ?? 0);
      months[idx].cost += Number(s.trainingProgram?.estimatedCost ?? 0);
    }
  }

  const budgetBase = Number(budgetAgg._sum.approvedAmount ?? 0) || Number(budgetAgg._sum.allocatedAmount ?? 0);
  const budgetUsed = Number(budgetAgg._sum.utilizedAmount ?? 0);

  // ── Phase 13 computations ───────────────────────────────────────────────────

  // Department names for the dept-wise chart.
  const deptIds = Array.from(new Set(schedulesForDim.map((s) => s.targetDepartmentId).filter((x): x is number => x != null)));
  const depts = deptIds.length
    ? await prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } })
    : [];
  const deptName = new Map(depts.map((d) => [d.id, d.name]));

  const byDepartmentMap = new Map<string, number>();
  const byCategoryMap = new Map<string, number>();
  for (const s of schedulesForDim) {
    const dept = s.targetDepartmentId != null ? deptName.get(s.targetDepartmentId) ?? 'Unassigned' : 'Company-wide';
    byDepartmentMap.set(dept, (byDepartmentMap.get(dept) ?? 0) + 1);
    const cat = s.trainingProgram?.category ?? 'Uncategorized';
    byCategoryMap.set(cat, (byCategoryMap.get(cat) ?? 0) + 1);
  }

  const mandatoryCount = nomsForMandatory.filter((n) => n.reason === 'MANDATORY').length;

  // Pre vs post average scores by assessment type.
  const prePostMap = new Map<string, { sum: number; n: number }>();
  for (const a of attemptsForPrePost) {
    const t = a.assessment?.assessmentType ?? 'POST';
    const cur = prePostMap.get(t) ?? { sum: 0, n: 0 };
    cur.sum += a.scorePercent; cur.n++;
    prePostMap.set(t, cur);
  }

  // Skill proficiency distribution by level name.
  const skillDistMap = new Map<string, number>();
  for (const s of empSkillLevels) {
    const name = s.currentLevel?.name ?? 'Unrated';
    skillDistMap.set(name, (skillDistMap.get(name) ?? 0) + 1);
  }

  // Gap %: share of applicable requirement-pairs where current < required.
  const compLevelMap = new Map(empCompetencies.map((c) => [`${c.employeeId}-${c.competencyId}`, c.currentLevel?.levelNumber ?? 0]));
  const jobOfEmp = new Map(employeesForGap.map((e) => [e.id, e.jobInfos[0] ?? null]));
  let compPairs = 0, compGaps = 0;
  for (const emp of employeesForGap) {
    const job = jobOfEmp.get(emp.id);
    for (const req of compReqs) {
      if (req.departmentId != null && req.departmentId !== job?.departmentId) continue;
      if (req.designationId != null && req.designationId !== job?.designationId) continue;
      if (req.gradeId != null && req.gradeId !== job?.gradeId) continue;
      if (req.jobRole != null && req.jobRole.trim().toLowerCase() !== (job?.jobTitle ?? '').trim().toLowerCase()) continue;
      compPairs++;
      if (req.requiredLevel.levelNumber - (compLevelMap.get(`${emp.id}-${req.competencyId}`) ?? 0) > 0) compGaps++;
    }
  }
  const skillLevelMap = new Map(empSkillLevels.map((s) => [`${s.employeeId}-${s.skillId}`, s.currentLevel?.levelNumber ?? 0]));
  let skillPairs = 0, skillGaps = 0;
  for (const emp of employeesForGap) {
    const job = jobOfEmp.get(emp.id);
    for (const req of skillReqs) {
      if (req.departmentId != null && req.departmentId !== job?.departmentId) continue;
      if (req.designationId != null && req.designationId !== job?.designationId) continue;
      if (req.gradeId != null && req.gradeId !== job?.gradeId) continue;
      if (req.jobRole != null && req.jobRole.trim().toLowerCase() !== (job?.jobTitle ?? '').trim().toLowerCase()) continue;
      skillPairs++;
      if (req.requiredLevel.levelNumber - (skillLevelMap.get(`${emp.id}-${req.skillId}`) ?? 0) > 0) skillGaps++;
    }
  }

  // Effectiveness trend: average improvement per evaluation stage (D30/D60/D90).
  const effStageMap = new Map<string, { sum: number; n: number }>();
  for (const e of effectivenessForTrend) {
    const st = e.evaluationStage ?? 'IMMEDIATE';
    const cur = effStageMap.get(st) ?? { sum: 0, n: 0 };
    cur.sum += e.scoreImprovement ?? 0; cur.n++;
    effStageMap.set(st, cur);
  }

  // §42 KPI formulas.
  const completionPct = plannedSchedulesAll > 0 ? Math.round((completedSchedulesAll / plannedSchedulesAll) * 100) : 0;
  const trainedEmployees = new Set(
    (await prisma.trainingAttendance.findMany({
      where: { companyId, deletedAt: null, status: { in: ['PRESENT', 'LATE'] } },
      select: { employeeId: true },
    })).map((a) => a.employeeId)
  ).size;
  const coveragePct = eligibleEmployees > 0 ? Math.round((trainedEmployees / eligibleEmployees) * 100) : 0;
  const attendancePct = nominatedTotal > 0 ? Math.min(100, Math.round((attendedTotal / nominatedTotal) * 100)) : 0;
  const assessedTotal = attemptsForPrePost.length;
  const passedTotal = assessmentResults.find((r) => r.result === 'PASS')?._count ?? 0;
  const assessmentPassPct = assessedTotal > 0 ? Math.round((passedTotal / assessedTotal) * 100) : 0;
  const totalHoursYtd = months.reduce((s, m) => s + m.hours, 0);
  const hoursPerEmployee = trainedEmployees > 0 ? Math.round((totalHoursYtd / trainedEmployees) * 10) / 10 : 0;

  return NextResponse.json({
    data: {
      kpis: {
        tnaPending,
        nominationsPending,
        schedulesUpcoming,
        schedulesCompletedThisMonth,
        plansApproved,
        plansDraft,
        competencyGaps,
        feedbackPending,
        programs,
        trainers,
        venues,
        trainingHoursThisMonth: Number(hoursThisMonthAgg._sum.duration ?? 0),
        estimatedCostYtd: costYtdAgg.reduce((s, r) => s + Number(r.trainingProgram?.estimatedCost ?? 0), 0),
        budgetUtilizationPct: budgetBase > 0 ? Math.round((budgetUsed / budgetBase) * 100) : 0,
        mandatoryPending,
        avgAssessmentScore: Math.round(Number(avgAssessmentAgg._avg.scorePercent ?? 0)),
        avgEffectivenessImprovement: Math.round(Number(avgImprovementAgg._avg.scoreImprovement ?? 0)),
        certificatesIssued,
        // §42 formula KPIs.
        completionPct,
        coveragePct,
        attendancePct,
        assessmentPassPct,
        competencyGapPct: compPairs > 0 ? Math.round((compGaps / compPairs) * 100) : 0,
        skillGapPct: skillPairs > 0 ? Math.round((skillGaps / skillPairs) * 100) : 0,
        gapClosurePct: (compPairs + skillPairs) > 0 ? Math.round(((compPairs + skillPairs - compGaps - skillGaps) / (compPairs + skillPairs)) * 100) : 0,
        hoursPerEmployee,
      },
      charts: {
        monthly: months,
        nominationsByStatus: nominationsByStatus.map((r) => ({ name: r.status, value: r._count })),
        effectivenessByRating: effectivenessByRating.map((r) => ({ name: r.effectivenessRating ?? '—', value: r._count })),
        attendanceByStatus: attendanceByStatus.map((r) => ({ name: r.status, value: r._count })),
        assessmentResults: assessmentResults.map((r) => ({ name: r.result, value: r._count })),
        // §6 additional graphs.
        byDepartment: [...byDepartmentMap.entries()].map(([name, value]) => ({ name, value })),
        byCategory: [...byCategoryMap.entries()].map(([name, value]) => ({ name, value })),
        mandatoryVsOptional: [
          { name: 'Mandatory', value: mandatoryCount },
          { name: 'Optional', value: nomsForMandatory.length - mandatoryCount },
        ],
        costByMonth: months.map((m) => ({ month: m.month, cost: m.cost })),
        preVsPost: [...prePostMap.entries()].map(([name, v]) => ({ name, value: Math.round(v.sum / v.n) })),
        skillDistribution: [...skillDistMap.entries()].map(([name, value]) => ({ name, value })),
        effectivenessTrend: [...effStageMap.entries()].map(([name, v]) => ({ name, value: Math.round(v.sum / v.n) })),
      },
      upcomingList,
    },
  });
}
