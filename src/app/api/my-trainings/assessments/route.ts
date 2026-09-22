/**
 * ESS assessment delivery (BRD §24–26) — the employee-facing counterpart to
 * /api/assessment-attempts.
 *
 * GET /api/my-trainings/assessments
 *   → assessments the employee can take: linked to a schedule they are
 *     nominated for, or company-wide assessments with no schedule link.
 *     Each row carries the latest attempt + attempt count so the UI can
 *     show Take / Resume / result state.
 *
 * GET /api/my-trainings/assessments?assessmentId=N
 *   → one assessment + its questions for the test screen. Questions are
 *     served in the open attempt's shuffled order (§25 randomQuestions)
 *     and NEVER include correctAnswer / explanation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

async function myEmployeeId(request: NextRequest): Promise<{ employeeId: number; companyId: number } | { error: NextResponse }> {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck;
  const employeeId = await resolveOwnEmployeeId(userId);
  if (!employeeId) {
    return { error: NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 }) };
  }
  return { employeeId, companyId: companyCheck.companyId };
}

/** Schedules the employee is nominated for (active nominations only). */
async function myScheduleIds(companyId: number, employeeId: number): Promise<number[]> {
  const noms = await prisma.trainingNomination.findMany({
    where: { companyId, employeeId, deletedAt: null, status: { notIn: ['REJECTED', 'CANCELLED'] } },
    select: { trainingScheduleId: true },
  });
  return noms.map((n) => n.trainingScheduleId);
}

function parseIds(json: string | null): number[] {
  try { return (JSON.parse(json ?? '[]') as number[]).filter((n) => Number.isFinite(n)); } catch { return []; }
}

export async function GET(request: NextRequest) {
  const me = await myEmployeeId(request);
  if ('error' in me) return me.error;
  const { employeeId, companyId } = me;

  const { searchParams } = new URL(request.url);
  const assessmentId = Number(searchParams.get('assessmentId'));

  const scheduleIds = await myScheduleIds(companyId, employeeId);

  // ── Single-assessment "take" payload ────────────────────────────────────
  if (assessmentId) {
    const assessment = await prisma.assessment.findFirst({
      where: { id: assessmentId, companyId, deletedAt: null, isActive: true },
      select: {
        id: true, title: true, description: true, assessmentType: true,
        passingScore: true, durationMinutes: true, maxAttempts: true,
        questionIds: true, trainingScheduleId: true,
      },
    });
    if (!assessment) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    // Eligibility: schedule-linked assessments need a nomination; open ones don't.
    if (assessment.trainingScheduleId && !scheduleIds.includes(assessment.trainingScheduleId)) {
      return NextResponse.json({ error: 'You are not nominated for this training' }, { status: 403 });
    }

    const attempts = await prisma.assessmentAttempt.findMany({
      where: { companyId, assessmentId, employeeId, deletedAt: null },
      orderBy: { attemptNumber: 'desc' },
    });
    const open = attempts.find((a) => !a.submittedAt) ?? null;
    const latest = attempts[0] ?? null;

    // Question order: the open attempt's shuffled snapshot, else the
    // assessment's configured order.
    const order = parseIds(open?.questionIdsJson ?? null).length
      ? parseIds(open?.questionIdsJson ?? null)
      : parseIds(assessment.questionIds);
    const questions = await prisma.questionBank.findMany({
      where: { id: { in: order }, companyId, deletedAt: null, isActive: true },
      // §24: correctAnswer and explanation must never reach the test-taker.
      select: { id: true, question: true, questionType: true, options: true, maxScore: true, difficulty: true },
    });
    const byId = new Map(questions.map((q) => [q.id, q]));
    const ordered = order.map((id) => byId.get(id)).filter(Boolean);

    return NextResponse.json({
      data: {
        assessment: {
          id: assessment.id, title: assessment.title, description: assessment.description,
          assessmentType: assessment.assessmentType, passingScore: assessment.passingScore,
          durationMinutes: assessment.durationMinutes, maxAttempts: assessment.maxAttempts,
        },
        questions: ordered,
        attempt: open ?? null,
        latestAttempt: latest?.submittedAt ? latest : null,
        attemptCount: attempts.filter((a) => a.submittedAt).length,
      },
    });
  }

  // ── List: assessments available to this employee ────────────────────────
  const assessments = await prisma.assessment.findMany({
    where: {
      companyId, deletedAt: null, isActive: true,
      OR: [
        { trainingScheduleId: { in: scheduleIds } },
        { trainingScheduleId: null },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, assessmentType: true, passingScore: true,
      durationMinutes: true, maxAttempts: true, trainingScheduleId: true, questionIds: true,
    },
  });
  const attempts = await prisma.assessmentAttempt.findMany({
    where: { companyId, employeeId, deletedAt: null, assessmentId: { in: assessments.map((a) => a.id) } },
    orderBy: { attemptNumber: 'desc' },
  });
  const latestByAssessment = new Map<number, (typeof attempts)[number]>();
  const countByAssessment = new Map<number, number>();
  for (const a of attempts) {
    if (!latestByAssessment.has(a.assessmentId)) latestByAssessment.set(a.assessmentId, a);
    if (a.submittedAt) countByAssessment.set(a.assessmentId, (countByAssessment.get(a.assessmentId) ?? 0) + 1);
  }
  const data = assessments.map((a) => ({
    ...a,
    questionCount: parseIds(a.questionIds).length,
    questionIds: undefined,
    latestAttempt: latestByAssessment.get(a.id) ?? null,
    attemptCount: countByAssessment.get(a.id) ?? 0,
  }));
  return NextResponse.json({ data });
}
