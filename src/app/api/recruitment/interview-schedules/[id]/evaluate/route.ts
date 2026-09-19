/**
 * Interview Evaluation submit — POST /api/recruitment/interview-schedules/:id/evaluate
 * BRD §5.11, §5.12. Submits per-criteria scores, calculates weighted total,
 * creates a summary with Pass/Fail/Hold/Re-interview recommendation.
 *
 * Also marks the schedule as "Completed" and updates candidate status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { evaluationSubmitSchema } from '@/lib/validations/recruitment';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scheduleId = parseInt(id);
  const body = await request.json();
  const parsed = evaluationSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const schedule = await prisma.interviewSchedule.findUnique({
    where: { id: scheduleId },
    include: { candidate: true, interviewLevel: true },
  });
  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });

  // Parse the process snapshot to get weightage per criteria
  let snapshot: { criteria: Array<{ criteriaId: number; maxScore: number; weightage: number; passingScore: number }> } = { criteria: [] };
  try {
    snapshot = JSON.parse(schedule.processSnapshot ?? '{}');
  } catch { /* empty snapshot */ }

  const weightMap = new Map(snapshot.criteria.map((c) => [c.criteriaId, c]));

  // Calculate totals
  let totalScore = 0;
  let maxPossible = 0;
  let weightedScore = 0;
  let totalWeight = 0;

  for (const ev of parsed.data.evaluations) {
    const cfg = weightMap.get(ev.criteriaId);
    const max = cfg?.maxScore ?? ev.maxScore;
    const weight = cfg?.weightage ?? 0;
    totalScore += ev.score;
    maxPossible += max;
    weightedScore += (ev.score / max) * weight;
    totalWeight += weight;
  }

  const normalizedWeighted = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;

  // Determine result based on passing score
  const passingScore = snapshot.criteria[0]?.passingScore ?? 70;
  const result = normalizedWeighted >= passingScore ? 'Pass' : 'Fail';

  // Determine recommendation
  let recommendation = parsed.data.recommendation ?? '';
  if (!recommendation) {
    recommendation = result === 'Pass' ? 'Select' : 'Reject';
  }

  // Submit evaluations + create summary in a transaction
  await prisma.$transaction(async (tx) => {
    // Delete any existing evaluations for this schedule (re-evaluation case)
    await tx.interviewEvaluation.deleteMany({ where: { scheduleId } });
    await tx.interviewEvaluationSummary.deleteMany({ where: { scheduleId } });

    // Create new evaluations
    for (const ev of parsed.data.evaluations) {
      await tx.interviewEvaluation.create({
        data: {
          scheduleId,
          criteriaId: ev.criteriaId,
          score: ev.score,
          maxScore: ev.maxScore,
          remarks: ev.remarks ?? null,
          submittedAt: new Date(),
        },
      });
    }

    // Create summary
    await tx.interviewEvaluationSummary.create({
      data: {
        scheduleId,
        totalScore,
        weightedScore: normalizedWeighted,
        result,
        recommendation,
        strengths: parsed.data.strengths ?? null,
        weaknesses: parsed.data.weaknesses ?? null,
        finalRemarks: parsed.data.finalRemarks ?? null,
      },
    });

    // Mark schedule as completed
    await tx.interviewSchedule.update({
      where: { id: scheduleId },
      data: { status: 'Completed' },
    });

    // Log activity
    await tx.candidateActivityLog.create({
      data: {
        candidateId: schedule.candidateId,
        action: `Interview evaluated — ${schedule.interviewLevel?.levelName ?? ''} (${result})`,
        toStatus: 'INTERVIEW_SCHEDULED',
        remarks: `Score: ${normalizedWeighted.toFixed(1)}% · ${recommendation}`,
      },
    });
  });

  const updated = await prisma.interviewSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      evaluationSummary: true,
      evaluations: { include: { criteria: { select: { criteriaName: true } } } },
    },
  });

  return NextResponse.json(updated);
}

/**
 * GET — fetch the evaluation form data (snapshot criteria + existing evaluations).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scheduleId = parseInt(id);
  const schedule = await prisma.interviewSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      evaluations: { include: { criteria: { select: { id: true, criteriaName: true } } } },
      evaluationSummary: true,
    },
  });
  if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let snapshot: { criteria: Array<{ criteriaId: number; criteriaName: string; maxScore: number; minScore: number; weightage: number; passingScore: number; ratingScale: string }> } = { criteria: [] };
  try {
    snapshot = JSON.parse(schedule.processSnapshot ?? '{}');
  } catch { /* empty */ }

  return NextResponse.json({
    schedule: {
      id: schedule.id,
      status: schedule.status,
      candidateId: schedule.candidateId,
      interviewLevelId: schedule.interviewLevelId,
      interviewTypeId: schedule.interviewTypeId,
    },
    criteria: snapshot.criteria,
    existingEvaluations: schedule.evaluations,
    summary: schedule.evaluationSummary,
  });
}
