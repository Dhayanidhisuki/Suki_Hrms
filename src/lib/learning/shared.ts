/**
 * Shared helpers for Learning API routes. Centralises the auth/company check,
 * actor extraction, and fire-and-forget audit + notification calls so every
 * Learning handler stays short and consistent.
 *
 * Audit is awaited (append-only, must exist before response) but never
 * throws on failure. Notifications are fire-and-forget (void + catch) so a
 * missing template can never fail the business transaction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';
import { emitPlatformEvent } from '@/lib/platform/events';
import { prisma } from '@/lib/prisma';
import type { PlatformActor } from '@/lib/platform/contracts';

export type LearningAuth = {
  companyId: number;
  actor: PlatformActor;
};

export function learningAuth(request: NextRequest): LearningAuth | { error: NextResponse } {
  const roleId = request.headers.get('x-role-id');
  if (!roleId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck;

  const actor: PlatformActor = {
    userId: Number(request.headers.get('x-user-id')) || null,
    employeeId: Number(request.headers.get('x-employee-id')) || null,
    source: 'user',
    ipAddress: request.headers.get('x-forwarded-for') ?? null,
  };

  return { companyId: companyCheck.companyId, actor };
}

export async function auditLearning(
  companyId: number,
  actor: PlatformActor,
  entityType: string,
  entityId: number | null,
  action: string,
  before?: unknown,
  after?: unknown,
  remark?: string,
): Promise<void> {
  await audit({
    companyId,
    entityType,
    entityId,
    action,
    actor,
    before,
    after,
    remark,
  });
}

/**
 * Resolve the caller's role name from x-role-id. Used for §51 protection
 * rules (e.g. only admins may delete completed records or set proficiency).
 */
export async function learningRoleName(request: NextRequest): Promise<string | null> {
  const roleId = Number(request.headers.get('x-role-id'));
  if (!roleId) return null;
  const role = await prisma.role.findFirst({ where: { id: roleId }, select: { name: true } });
  return role?.name ?? null;
}

/** True when the caller holds an administrative role (Company/HR Admin). */
export async function isLearningAdmin(request: NextRequest): Promise<boolean> {
  const name = (await learningRoleName(request)) ?? '';
  return /admin/i.test(name);
}

/** True when the caller holds an HR or admin role (HR-stage approvers). */
export async function isLearningHrOrAdmin(request: NextRequest): Promise<boolean> {
  const name = (await learningRoleName(request)) ?? '';
  return /hr|admin/i.test(name);
}

/* ------------------------------------------------------------------ */
/* §4 role-scoped actions — trainers/mentors act on their own records  */
/* ------------------------------------------------------------------ */

/** Resolve the caller's employeeId — x-employee-id header, else Employee.userId. */
export async function callerEmployeeId(companyId: number, actor: PlatformActor): Promise<number | null> {
  if (actor.employeeId) return actor.employeeId;
  if (!actor.userId) return null;
  const emp = await prisma.employee.findFirst({
    where: { userId: actor.userId, companyId, deletedAt: null },
    select: { id: true },
  });
  return emp?.id ?? null;
}

/** §4: is the employee a trainer (or co-trainer) assigned to this schedule? */
export async function isScheduleTrainer(companyId: number, scheduleId: number, employeeId: number | null): Promise<boolean> {
  if (!employeeId) return false;
  const schedule = await prisma.trainingSchedule.findFirst({
    where: { id: scheduleId, companyId, deletedAt: null },
    select: { trainerId: true, coTrainerId: true },
  });
  if (!schedule) return false;
  const trainerIds = await prisma.trainer.findMany({
    where: { companyId, employeeId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  const mine = new Set(trainerIds.map((t) => t.id));
  return (!!schedule.trainerId && mine.has(schedule.trainerId)) || (!!schedule.coTrainerId && mine.has(schedule.coTrainerId));
}

/** §4: is the employee the mentor assigned to this schedule? */
export async function isScheduleMentor(companyId: number, scheduleId: number, employeeId: number | null): Promise<boolean> {
  if (!employeeId) return false;
  const schedule = await prisma.trainingSchedule.findFirst({
    where: { id: scheduleId, companyId, deletedAt: null },
    select: { mentorEmployeeId: true, mentorId: true },
  });
  if (!schedule) return false;
  if (schedule.mentorEmployeeId === employeeId) return true;
  if (!schedule.mentorId) return false;
  const mentor = await prisma.trainingMentor.findFirst({
    where: { id: schedule.mentorId, companyId, deletedAt: null },
    select: { employeeId: true },
  });
  return mentor?.employeeId === employeeId;
}

/** §4/§22: admin/HR, the schedule's trainer, or its mentor may mark attendance. */
export async function canMarkAttendance(request: NextRequest, companyId: number, scheduleId: number, actor: PlatformActor): Promise<boolean> {
  if (await isLearningHrOrAdmin(request)) return true;
  const empId = await callerEmployeeId(companyId, actor);
  return (await isScheduleTrainer(companyId, scheduleId, empId)) || (await isScheduleMentor(companyId, scheduleId, empId));
}

/** §4/§24: admin/HR or the schedule's trainer may grade its assessments. */
export async function canGradeAssessment(request: NextRequest, companyId: number, assessmentId: number, actor: PlatformActor): Promise<boolean> {
  if (await isLearningHrOrAdmin(request)) return true;
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, companyId, deletedAt: null },
    select: { trainingScheduleId: true },
  });
  if (!assessment?.trainingScheduleId) return false;
  const empId = await callerEmployeeId(companyId, actor);
  return isScheduleTrainer(companyId, assessment.trainingScheduleId, empId);
}

/** §4/§28: admin/HR, the schedule's mentor, or its trainer may evaluate. */
export async function canEvaluateSchedule(request: NextRequest, companyId: number, scheduleId: number, actor: PlatformActor): Promise<boolean> {
  if (await isLearningHrOrAdmin(request)) return true;
  const empId = await callerEmployeeId(companyId, actor);
  return (await isScheduleMentor(companyId, scheduleId, empId)) || (await isScheduleTrainer(companyId, scheduleId, empId));
}

/** §38: role-based document access — null/blank accessRoles = all roles. */
export async function canAccessDocument(request: NextRequest, accessRoles: string | null): Promise<boolean> {
  const roles = (accessRoles ?? '').split(',').map((r) => r.trim().toLowerCase()).filter(Boolean);
  if (roles.length === 0) return true;
  if (await isLearningAdmin(request)) return true;
  const name = ((await learningRoleName(request)) ?? '').trim().toLowerCase();
  return !!name && roles.includes(name);
}

export function notifyLearning(
  companyId: number,
  eventCode: string,
  ctx: Parameters<typeof emitPlatformEvent>[2],
): void {
  void emitPlatformEvent(companyId, eventCode, ctx).catch((err) => {
    console.warn(`[learning/notify] ${eventCode} failed:`, (err as Error).message);
  });
}

/* ------------------------------------------------------------------ */
/* Multi-level approval engine (BRD §21)                               */
/* ------------------------------------------------------------------ */
/**
 * Reuses the project's ApprovalChainConfig table. When a chain is
 * configured for the given module (e.g. 'TRAINING', 'TRAINING_NOMINATION')
 * an APPROVE advances `currentStageOrder` stage-by-stage; only the final
 * stage returns 'APPROVED'. With no chain configured the call falls back
 * to single-step approve/reject so existing behaviour is preserved.
 */
export type LearningApprovalAction = 'APPROVE' | 'REJECT' | 'RETURN' | 'RESUBMIT' | 'CANCEL';

export type LearningApprovalResult =
  | { outcome: 'APPROVED' }
  | { outcome: 'REJECTED' }
  | { outcome: 'RETURNED' }
  | { outcome: 'CANCELLED' }
  | { outcome: 'RESUBMITTED'; firstStageOrder: number | null }
  | { outcome: 'ADVANCED'; nextStageOrder: number; stageName: string }
  | { error: NextResponse };

export async function learningApprovalStep(
  request: NextRequest,
  companyId: number,
  actor: PlatformActor,
  opts: {
    module: string;
    /** Employee whose record is being approved (for REPORTING_MANAGER stages). */
    subjectEmployeeId?: number | null;
    currentStageOrder?: number | null;
    action: LearningApprovalAction;
  },
): Promise<LearningApprovalResult> {
  const chain = await prisma.approvalChainConfig.findMany({
    where: { companyId, module: opts.module, isActive: true },
    orderBy: { stageOrder: 'asc' },
  });

  // RESUBMIT: send a RETURNED record back to stage 1.
  if (opts.action === 'RESUBMIT') {
    return { outcome: 'RESUBMITTED', firstStageOrder: chain[0]?.stageOrder ?? null };
  }

  // CANCEL (§21): terminal — caller routes enforce who may cancel (creator
  // or admin). Allowed at any stage.
  if (opts.action === 'CANCEL') {
    return { outcome: 'CANCELLED' };
  }

  // No chain configured → legacy single-step behaviour.
  if (chain.length === 0) {
    if (opts.action === 'APPROVE') return { outcome: 'APPROVED' };
    if (opts.action === 'REJECT') return { outcome: 'REJECTED' };
    if (opts.action === 'RETURN') return { outcome: 'RETURNED' };
    return { error: NextResponse.json({ error: 'Unknown action' }, { status: 400 }) };
  }

  // REJECT / RETURN end the flow at any stage (rejection is terminal,
  // return sends it back for correction and it must be resubmitted).
  if (opts.action === 'REJECT') {
    return await canActOnStage(request, companyId, actor, opts, chain, 'reject')
      ? { outcome: 'REJECTED' }
      : { error: NextResponse.json({ error: 'You cannot reject at this stage' }, { status: 403 }) };
  }
  if (opts.action === 'RETURN') {
    return await canActOnStage(request, companyId, actor, opts, chain, 'return')
      ? { outcome: 'RETURNED' }
      : { error: NextResponse.json({ error: 'You cannot return at this stage' }, { status: 403 }) };
  }

  // APPROVE — caller must be the approver for the current stage.
  const stage = chain.find((c) => c.stageOrder === (opts.currentStageOrder || chain[0].stageOrder));
  if (!stage) {
    return { error: NextResponse.json({ error: 'Invalid approval stage' }, { status: 409 }) };
  }
  if (!(await canActOnStage(request, companyId, actor, opts, chain, 'approve', stage))) {
    return { error: NextResponse.json({ error: `Only the ${stage.stageName} approver can approve this stage` }, { status: 403 }) };
  }

  const next = chain.find((c) => c.stageOrder > stage.stageOrder);
  if (next) {
    return { outcome: 'ADVANCED', nextStageOrder: next.stageOrder, stageName: next.stageName };
  }
  return { outcome: 'APPROVED' };
}

async function canActOnStage(
  request: NextRequest,
  companyId: number,
  actor: PlatformActor,
  opts: { subjectEmployeeId?: number | null; currentStageOrder?: number | null },
  chain: { stageOrder: number; stageName: string; approverType: string; approverRoleId: number | null; approverUserId: number | null }[],
  _verb: string,
  explicitStage?: (typeof chain)[number],
): Promise<boolean> {
  const stage = explicitStage ?? chain.find((c) => c.stageOrder === (opts.currentStageOrder || chain[0].stageOrder));
  if (!stage) return true; // stageless record — let the caller decide

  if (await isLearningAdmin(request)) return true; // admins may act at any stage

  switch (stage.approverType) {
    case 'REPORTING_MANAGER': {
      if (!opts.subjectEmployeeId || !actor.userId) return false;
      const [subject, self] = await Promise.all([
        prisma.employee.findFirst({ where: { id: opts.subjectEmployeeId, companyId }, select: { reportingManagerId: true } }),
        prisma.employee.findFirst({ where: { userId: actor.userId, companyId }, select: { id: true } }),
      ]);
      return !!subject?.reportingManagerId && subject.reportingManagerId === self?.id;
    }
    case 'HR': {
      const name = (await learningRoleName(request)) ?? '';
      return /hr|admin/i.test(name);
    }
    case 'ROLE': {
      return stage.approverRoleId === Number(request.headers.get('x-role-id'));
    }
    case 'SPECIFIC_USER': {
      return stage.approverUserId === actor.userId;
    }
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ */
/* Proficiency promotion + Re-TNA loop closure (BRD §51, §52)          */
/* ------------------------------------------------------------------ */
/**
 * After an authorized level change (assessment PASS with promoteOnPass,
 * or an admin update), marks open TNA requests for that employee+item as
 * RESOLVED when the current level now meets the required level.
 * Never throws — callers shouldn't fail a transaction over this.
 */
export async function resolveTnaIfGapClosed(
  companyId: number,
  employeeId: number,
  itemType: 'COMPETENCY' | 'SKILL',
  itemId: number,
): Promise<number> {
  try {
    // Current level for this item.
    const currentLevelNumber = itemType === 'COMPETENCY'
      ? (await prisma.employeeCompetency.findFirst({
          where: { companyId, employeeId, competencyId: itemId, deletedAt: null },
          include: { currentLevel: { select: { levelNumber: true } } },
        }))?.currentLevel?.levelNumber ?? 0
      : (await prisma.employeeSkillLevel.findFirst({
          where: { companyId, employeeId, skillId: itemId, deletedAt: null },
          include: { currentLevel: { select: { levelNumber: true } } },
        }))?.currentLevel?.levelNumber ?? 0;

    // Required level for the employee's role scope.
    const job = await prisma.jobInfo.findFirst({
      where: { employeeId, effectiveTo: null },
      select: { departmentId: true, designationId: true, gradeId: true, jobTitle: true },
    });
    const reqWhere = { companyId, deletedAt: null, isActive: true } as const;
    const reqs = itemType === 'COMPETENCY'
      ? await prisma.competencyRequirement.findMany({ where: { ...reqWhere, competencyId: itemId }, include: { requiredLevel: { select: { levelNumber: true } } } })
      : await prisma.skillRequirement.findMany({ where: { ...reqWhere, skillId: itemId }, include: { requiredLevel: { select: { levelNumber: true } } } });
    const applicable = reqs.filter((r) =>
      (r.departmentId == null || r.departmentId === job?.departmentId) &&
      (r.designationId == null || r.designationId === job?.designationId) &&
      (r.gradeId == null || r.gradeId === job?.gradeId) &&
      (r.jobRole == null || r.jobRole.trim().toLowerCase() === (job?.jobTitle ?? '').trim().toLowerCase()));
    const required = applicable.length ? Math.max(...applicable.map((r) => r.requiredLevel.levelNumber)) : 0;
    if (required <= 0 || currentLevelNumber < required) return 0;

    // Gap closed → resolve open TNA requests for this employee+item.
    // TNA only links competencyId, so skill closures can't be mapped to a
    // specific request — skip rather than risk closing unrelated TNAs.
    if (itemType !== 'COMPETENCY') return 0;
    const open = await prisma.trainingNeedRequest.findMany({
      where: {
        companyId, employeeId, competencyId: itemId, deletedAt: null,
        status: { in: ['SUBMITTED', 'APPROVED', 'PLANNED'] },
      },
    });
    if (open.length === 0) return 0;

    await prisma.trainingNeedRequest.updateMany({
      where: { id: { in: open.map((t) => t.id) } },
      data: { status: 'RESOLVED' },
    });
    return open.length;
  } catch (err) {
    console.warn('[learning/resolve-tna] failed:', (err as Error).message);
    return 0;
  }
}

/**
 * §51: when an assessment has promoteOnPass enabled, a PASS promotes the
 * employee's competency/skill to promoteToLevelId. Resolves the item via
 * the assessment's schedule→program (or direct program link). Audited.
 */
export async function promoteOnAssessmentPass(opts: {
  companyId: number;
  actor: PlatformActor;
  employeeId: number;
  assessmentId: number;
  attemptId: number;
}): Promise<{ promoted: boolean; itemType?: 'COMPETENCY' | 'SKILL'; itemId?: number }> {
  const { companyId, actor, employeeId, assessmentId, attemptId } = opts;
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, companyId, deletedAt: null },
    select: {
      id: true, promoteOnPass: true, promoteToLevelId: true,
      trainingProgramId: true, trainingScheduleId: true,
    },
  });
  if (!assessment?.promoteOnPass || !assessment.promoteToLevelId) return { promoted: false };

  const scheduleProgramId = assessment.trainingProgramId == null && assessment.trainingScheduleId != null
    ? (await prisma.trainingSchedule.findFirst({
        where: { id: assessment.trainingScheduleId, companyId },
        select: { trainingProgramId: true },
      }))?.trainingProgramId ?? null
    : null;
  const programId = assessment.trainingProgramId ?? scheduleProgramId;
  if (!programId) return { promoted: false };
  const program = await prisma.trainingProgram.findFirst({
    where: { id: programId, companyId },
    select: { competencyId: true, skillId: true },
  });
  const itemType: 'COMPETENCY' | 'SKILL' | null = program?.competencyId ? 'COMPETENCY' : program?.skillId ? 'SKILL' : null;
  const itemId = program?.competencyId ?? program?.skillId ?? null;
  if (!itemType || !itemId) return { promoted: false };

  const level = await prisma.skillLevel.findFirst({
    where: { id: assessment.promoteToLevelId, companyId, deletedAt: null },
    select: { id: true, levelNumber: true, name: true },
  });
  if (!level) return { promoted: false };

  if (itemType === 'COMPETENCY') {
    await prisma.employeeCompetency.upsert({
      where: { companyId_employeeId_competencyId: { companyId, employeeId, competencyId: itemId } },
      update: { currentLevelId: level.id },
      create: { companyId, employeeId, competencyId: itemId, currentLevelId: level.id },
    });
  } else {
    const existing = await prisma.employeeSkillLevel.findFirst({
      where: { companyId, employeeId, skillId: itemId, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      await prisma.employeeSkillLevel.update({ where: { id: existing.id }, data: { currentLevelId: level.id } });
    } else {
      await prisma.employeeSkillLevel.create({
        data: { companyId, employeeId, skillId: itemId, currentLevelId: level.id },
      });
    }
  }

  await auditLearning(companyId, actor, 'AssessmentAttempt', attemptId, 'PROMOTE', null,
    { employeeId, itemType, itemId, levelId: level.id },
    `Assessment pass promoted ${itemType.toLowerCase()} #${itemId} → ${level.name}`);

  const resolved = await resolveTnaIfGapClosed(companyId, employeeId, itemType, itemId);
  if (resolved > 0) {
    await auditLearning(companyId, actor, 'TrainingNeedRequest', null, 'RESOLVE', null,
      { employeeId, itemType, itemId, resolved },
      `Gap closed — ${resolved} TNA request(s) resolved`);
  }
  return { promoted: true, itemType, itemId };
}

/**
 * §52: when a manager's post-training evaluation shows strong skill
 * improvement (avg of the manager-section ratings ≥ 4/5), promote the
 * employee one level in the competency/skill addressed by the schedule's
 * program. Conservative: only ever moves up, never skips levels, no-op
 * when already at top. Audited + feeds the re-TNA loop.
 */
export async function promoteOnEffectiveness(opts: {
  companyId: number;
  actor: PlatformActor;
  employeeId: number;
  trainingScheduleId: number;
  effectivenessId: number;
  managerRatings: (number | null | undefined)[];
}): Promise<{ promoted: boolean }> {
  const { companyId, actor, employeeId, trainingScheduleId, effectivenessId, managerRatings } = opts;
  const ratings = managerRatings.filter((r): r is number => typeof r === 'number');
  if (ratings.length === 0) return { promoted: false };
  const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
  if (avg < 4) return { promoted: false };

  const schedule = await prisma.trainingSchedule.findFirst({
    where: { id: trainingScheduleId, companyId },
    select: { trainingProgramId: true },
  });
  const program = schedule?.trainingProgramId
    ? await prisma.trainingProgram.findFirst({
        where: { id: schedule.trainingProgramId, companyId },
        select: { competencyId: true, skillId: true },
      })
    : null;
  const itemType: 'COMPETENCY' | 'SKILL' | null = program?.competencyId ? 'COMPETENCY' : program?.skillId ? 'SKILL' : null;
  const itemId = program?.competencyId ?? program?.skillId ?? null;
  if (!itemType || !itemId) return { promoted: false };

  const current = itemType === 'COMPETENCY'
    ? await prisma.employeeCompetency.findFirst({
        where: { companyId, employeeId, competencyId: itemId, deletedAt: null },
        include: { currentLevel: { select: { levelNumber: true } } },
      })
    : await prisma.employeeSkillLevel.findFirst({
        where: { companyId, employeeId, skillId: itemId, deletedAt: null },
        include: { currentLevel: { select: { levelNumber: true } } },
      });
  const currentNum = current?.currentLevel?.levelNumber ?? 0;

  const nextLevel = await prisma.skillLevel.findFirst({
    where: { companyId, deletedAt: null, levelNumber: { gt: currentNum } },
    orderBy: { levelNumber: 'asc' },
    select: { id: true, name: true },
  });
  if (!nextLevel) return { promoted: false }; // already at top

  if (itemType === 'COMPETENCY') {
    await prisma.employeeCompetency.upsert({
      where: { companyId_employeeId_competencyId: { companyId, employeeId, competencyId: itemId } },
      update: { currentLevelId: nextLevel.id },
      create: { companyId, employeeId, competencyId: itemId, currentLevelId: nextLevel.id },
    });
  } else if (current) {
    await prisma.employeeSkillLevel.update({ where: { id: current.id }, data: { currentLevelId: nextLevel.id } });
  } else {
    await prisma.employeeSkillLevel.create({
      data: { companyId, employeeId, skillId: itemId, currentLevelId: nextLevel.id },
    });
  }

  await auditLearning(companyId, actor, 'TrainingEffectiveness', effectivenessId, 'PROMOTE', null,
    { employeeId, itemType, itemId, levelId: nextLevel.id, avgRating: Math.round(avg * 100) / 100 },
    `Manager eval (avg ${Math.round(avg * 100) / 100}/5) promoted ${itemType.toLowerCase()} #${itemId} → ${nextLevel.name}`);

  await resolveTnaIfGapClosed(companyId, employeeId, itemType, itemId);
  return { promoted: true };
}

/**
 * §34/§51 Budget helpers.
 * Budgets are keyed (companyId, year, departmentId) — departmentId null means
 * company-wide. `resolveBudget` prefers the department-specific row and falls
 * back to the company-wide one.
 */
export async function resolveBudget(companyId: number, year: string, departmentId: number | null) {
  if (departmentId != null) {
    const dept = await prisma.trainingBudget.findFirst({
      where: { companyId, year, departmentId, deletedAt: null, isActive: true },
    });
    if (dept) return dept;
  }
  return prisma.trainingBudget.findFirst({
    where: { companyId, year, departmentId: null, deletedAt: null, isActive: true },
  });
}

/**
 * §51: returns a message when `additional` spend would push utilization past
 * the approved amount, otherwise null. Callers decide whether to block.
 */
export function budgetExceeded(
  budget: { allocatedAmount: unknown; approvedAmount: unknown; utilizedAmount: unknown } | null,
  additional: number,
): string | null {
  if (!budget) return null; // no budget configured → nothing to enforce
  const approved = Number(budget.approvedAmount ?? budget.allocatedAmount ?? 0);
  if (approved <= 0) return null;
  const utilized = Number(budget.utilizedAmount ?? 0);
  if (utilized + additional > approved) {
    return `Budget exceeded — approved ${approved.toLocaleString()}, already utilized ${utilized.toLocaleString()}, this adds ${additional.toLocaleString()}`;
  }
  return null;
}

/** Move utilizedAmount by `delta` (positive = spend, negative = reversal). */
export async function adjustBudgetUtilization(
  companyId: number, year: string, departmentId: number | null, delta: number,
) {
  const budget = await resolveBudget(companyId, year, departmentId);
  if (!budget) return;
  await prisma.trainingBudget.update({
    where: { id: budget.id },
    data: { utilizedAmount: { increment: delta } },
  });
}
