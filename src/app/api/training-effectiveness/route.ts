/**
 * Training Effectiveness (BRD §27–28).
 *
 * GET  /api/training-effectiveness?scheduleId=  → list effectiveness records
 * POST /api/training-effectiveness              → create/update (upsert on
 *   unique [companyId, trainingScheduleId, employeeId])
 *
 * On create/update, auto-computes:
 *  - scoreImprovement = postScore - preScore
 *  - effectivenessRating from level2Learning improvement (if not supplied):
 *      >=75% improvement → EXCELLENT, >=50% → GOOD, >=25% → AVERAGE, else POOR
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { trainingEffectivenessSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning, promoteOnEffectiveness, canEvaluateSchedule, callerEmployeeId } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const scheduleId = searchParams.get('scheduleId') ?? '';
  const employeeId = searchParams.get('employeeId') ?? '';
  const evaluationStage = searchParams.get('evaluationStage') ?? '';
  const effectivenessRating = searchParams.get('effectivenessRating') ?? '';

  const where = {
    companyId,
    deletedAt: null,
    ...(scheduleId ? { trainingScheduleId: parseInt(scheduleId) } : {}),
    ...(employeeId ? { employeeId: parseInt(employeeId) } : {}),
    ...(evaluationStage ? { evaluationStage } : {}),
    ...(effectivenessRating ? { effectivenessRating } : {}),
  };

  const data = await prisma.trainingEffectiveness.findMany({ where, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = trainingEffectivenessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Auto-compute score improvement.
  let scoreImprovement: number | null = null;
  if (parsed.data.preScore != null && parsed.data.postScore != null) {
    scoreImprovement = parsed.data.postScore - parsed.data.preScore;
  }

  // Auto-rate effectiveness if not explicitly supplied.
  let effectivenessRating = parsed.data.effectivenessRating ?? null;
  if (!effectivenessRating && scoreImprovement != null) {
    if (scoreImprovement >= 75) effectivenessRating = 'EXCELLENT';
    else if (scoreImprovement >= 50) effectivenessRating = 'GOOD';
    else if (scoreImprovement >= 25) effectivenessRating = 'AVERAGE';
    else effectivenessRating = 'POOR';
  }

  const data = {
    ...parsed.data,
    companyId,
    scoreImprovement,
    effectivenessRating,
    evaluationDate: parsed.data.evaluationDate ?? null,
  };

  // §4: HR/Admin, the schedule's mentor/trainer, or the employee themself
  // (self-evaluation) may submit an effectiveness record.
  const callerEmp = await callerEmployeeId(companyId, actor);
  if (callerEmp !== parsed.data.employeeId && !(await canEvaluateSchedule(request, companyId, parsed.data.trainingScheduleId, actor))) {
    return NextResponse.json({ error: 'Only HR, the assigned mentor/trainer, or the employee may submit this evaluation' }, { status: 403 });
  }

  // Upsert on unique [companyId, trainingScheduleId, employeeId].
  const existing = await prisma.trainingEffectiveness.findFirst({
    where: { companyId, trainingScheduleId: parsed.data.trainingScheduleId, employeeId: parsed.data.employeeId, deletedAt: null },
  });

  let record;
  if (existing) {
    record = await prisma.trainingEffectiveness.update({ where: { id: existing.id }, data });
    await auditLearning(companyId, actor, 'TrainingEffectiveness', existing.id, 'UPDATE', existing, record);
  } else {
    record = await prisma.trainingEffectiveness.create({ data });
    await auditLearning(companyId, actor, 'TrainingEffectiveness', record.id, 'CREATE', null, record);
  }

  // §36: keep TrainingHistory in sync — the effectiveness rating is part of
  // the employee's permanent training record.
  if (effectivenessRating) {
    await prisma.trainingHistory.updateMany({
      where: {
        companyId,
        employeeId: parsed.data.employeeId,
        trainingScheduleId: parsed.data.trainingScheduleId,
        deletedAt: null,
      },
      data: { effectivenessRating },
    });
  }

  // §52: strong manager evaluation promotes proficiency one level and can
  // close the open TNA loop (opt-in by data — only fires when manager
  // ratings were actually submitted).
  await promoteOnEffectiveness({
    companyId,
    actor,
    employeeId: parsed.data.employeeId,
    trainingScheduleId: parsed.data.trainingScheduleId,
    effectivenessId: record.id,
    managerRatings: [
      record.applicationOfLearning,
      record.behavioralChange,
      record.skillImprovement,
      record.productivityImprovement,
      record.qualityImprovement,
    ],
  });

  return NextResponse.json(record, { status: 201 });
}
