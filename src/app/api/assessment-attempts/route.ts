/**
 * Assessment attempts (BRD §24–26).
 *
 * POST   /api/assessment-attempts          → start or submit an attempt
 * GET    /api/assessment-attempts?assessmentId=&employeeId= → read an attempt
 * PATCH  /api/assessment-attempts { attemptId, scores } → manual grading
 *
 * Submit logic:
 *  - Parses answersJson: [{ questionId, answer, score }]
 *  - §26 timer: submits after startedAt + durationMinutes (+60s grace) → 409
 *  - §25 randomQuestions: attempt stores a shuffled questionIdsJson order
 *  - §25 negativeMarking: wrong objective answers deduct 25% of maxScore
 *  - §24 manual grading: answers on non-auto types stay unscored → the
 *    attempt lands in GRADING_PENDING until PATCH supplies scores
 *  - Computes totalScore, maxScore, scorePercent, result (PASS/FAIL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assessmentAttemptSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning, notifyLearning, promoteOnAssessmentPass, isLearningAdmin, canGradeAssessment } from '@/lib/learning/shared';

const TIMER_GRACE_SECONDS = 60;
const NEGATIVE_MARK_RATIO = 0.25;

// Question types scored by exact/normalized match (all others need grading).
const AUTO_TYPES = new Set(['MCQ', 'TRUE_FALSE', 'MULTI_SELECT', 'MULTIPLE_SELECT', 'FILL_BLANK']);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Normalized multi-answer compare: "A,C" / "a, c" / ["a","c"] all match. */
function answersMatch(given: string, correct: string): boolean {
  const norm = (s: string) => s.split(/[,|;]/).map((x) => x.trim().toLowerCase()).filter(Boolean).sort().join('|');
  const g = norm(given);
  const c = norm(correct);
  return g.length > 0 && g === c;
}

/** Group flags (random/negative) that apply to this assessment's questions. */
async function groupFlagsFor(companyId: number, questionIdsJson: string | null) {
  let ids: number[] = [];
  try { ids = JSON.parse(questionIdsJson ?? '[]'); } catch { /* ignore */ }
  if (ids.length === 0) return { randomQuestions: false, negativeMarking: false };
  const groups = await prisma.questionBankGroup.findMany({
    where: { companyId, deletedAt: null, questions: { some: { id: { in: ids }, deletedAt: null } } },
    select: { randomQuestions: true, negativeMarking: true },
  });
  return {
    randomQuestions: groups.some((g) => g.randomQuestions),
    negativeMarking: groups.some((g) => g.negativeMarking),
  };
}

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const assessmentId = searchParams.get('assessmentId') ?? '';
  const employeeId = searchParams.get('employeeId') ?? '';
  const pendingGrading = searchParams.get('pendingGrading');

  if (pendingGrading === '1') {
    // §24: attempts awaiting manual grading (admin/trainer queue).
    const data = await prisma.assessmentAttempt.findMany({
      where: { companyId, deletedAt: null, result: 'GRADING_PENDING' },
      orderBy: { submittedAt: 'asc' },
    });
    return NextResponse.json({ data });
  }

  if (!assessmentId || !employeeId) {
    return NextResponse.json({ error: 'assessmentId and employeeId are required' }, { status: 400 });
  }

  const attempts = await prisma.assessmentAttempt.findMany({
    where: { companyId, assessmentId: parseInt(assessmentId), employeeId: parseInt(employeeId), deletedAt: null },
    orderBy: { attemptNumber: 'desc' },
  });

  return NextResponse.json({ data: attempts[0] ?? null, attempts });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = assessmentAttemptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // ESS callers omit employeeId → resolve their own; admins may supply any.
  const employeeId = parsed.data.employeeId ?? actor.employeeId ?? 0;
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId could not be resolved from the session' }, { status: 400 });
  }

  // Confirm assessment belongs to company.
  const assessment = await prisma.assessment.findFirst({
    where: { id: parsed.data.assessmentId, companyId, deletedAt: null },
    select: { id: true, passingScore: true, questionIds: true, maxAttempts: true, durationMinutes: true, trainingScheduleId: true },
  });
  if (!assessment) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });

  // §51: non-admin users may only start/submit attempts for themselves, and
  // for schedule-linked assessments must hold an active nomination.
  if (!(await isLearningAdmin(request))) {
    if (!actor.employeeId || actor.employeeId !== employeeId) {
      return NextResponse.json({ error: 'You may only submit attempts for yourself' }, { status: 403 });
    }
    if (assessment.trainingScheduleId) {
      const nom = await prisma.trainingNomination.findFirst({
        where: { companyId, trainingScheduleId: assessment.trainingScheduleId, employeeId, deletedAt: null, status: { notIn: ['REJECTED', 'CANCELLED'] } },
        select: { id: true },
      });
      if (!nom) {
        return NextResponse.json({ error: 'You are not nominated for this training' }, { status: 403 });
      }
    }
  }

  // Re-attempt support (BRD §26): multiple attempts up to assessment.maxAttempts.
  // An unsubmitted attempt is resumed; a submitted one counts toward the limit.
  const attempts = await prisma.assessmentAttempt.findMany({
    where: { companyId, assessmentId: parsed.data.assessmentId, employeeId, deletedAt: null },
    orderBy: { attemptNumber: 'desc' },
  });
  const openAttempt = attempts.find((a) => !a.submittedAt);
  const submittedCount = attempts.filter((a) => a.submittedAt).length;

  // If no answers yet → start attempt (resume incomplete, else create next).
  if (!parsed.data.answersJson) {
    if (openAttempt) return NextResponse.json(openAttempt);
    if (submittedCount >= assessment.maxAttempts) {
      return NextResponse.json({ error: `Maximum attempts reached (${assessment.maxAttempts})` }, { status: 400 });
    }

    // §25: randomized question order when the question group asks for it.
    const flags = await groupFlagsFor(companyId, assessment.questionIds);
    let questionOrder: number[] | null = null;
    try {
      const ids = JSON.parse(assessment.questionIds ?? '[]') as number[];
      if (ids.length > 0) questionOrder = flags.randomQuestions ? shuffle(ids) : ids;
    } catch { /* ignore */ }

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        companyId,
        assessmentId: parsed.data.assessmentId,
        employeeId,
        attemptNumber: attempts.length + 1,
        questionIdsJson: questionOrder ? JSON.stringify(questionOrder) : null,
      },
    });
    await auditLearning(companyId, actor, 'AssessmentAttempt', attempt.id, 'START', null, attempt, `Attempt ${attempt.attemptNumber} started`);
    return NextResponse.json(attempt, { status: 201 });
  }

  // §26 timer enforcement: a timed assessment cannot be submitted late.
  if (openAttempt && assessment.durationMinutes && openAttempt.startedAt) {
    const deadline = openAttempt.startedAt.getTime() + assessment.durationMinutes * 60_000 + TIMER_GRACE_SECONDS * 1000;
    if (Date.now() > deadline) {
      return NextResponse.json(
        { error: `Time expired — this assessment allows ${assessment.durationMinutes} minutes` },
        { status: 409 }
      );
    }
  }

  // Submit: parse answers and auto-score.
  let answers: Array<{ questionId: number; answer: string; score?: number | null }> = [];
  try {
    answers = JSON.parse(parsed.data.answersJson);
  } catch {
    return NextResponse.json({ error: 'Invalid answersJson format' }, { status: 400 });
  }

  // Load questions for scoring.
  const questionIds = answers.map((a) => a.questionId);
  const questions = await prisma.questionBank.findMany({
    where: { id: { in: questionIds }, companyId, deletedAt: null },
    select: { id: true, correctAnswer: true, maxScore: true, questionType: true },
  });
  const flags = await groupFlagsFor(companyId, assessment.questionIds);

  let totalScore = 0;
  let maxScore = 0;
  let needsGrading = false;
  const scoredAnswers = answers.map((a) => {
    const q = questions.find((q) => q.id === a.questionId);
    if (!q) return { ...a, score: 0 };
    maxScore += q.maxScore;

    const autoType = AUTO_TYPES.has((q.questionType ?? '').toUpperCase());
    if (!autoType || !q.correctAnswer) {
      // §24: descriptive/scenario/practical/rating → manual grading.
      needsGrading = true;
      return { ...a, score: null };
    }

    const isCorrect = answersMatch(a.answer, q.correctAnswer);
    let score = isCorrect ? q.maxScore : 0;
    // §25: negative marking on wrong objective answers.
    if (!isCorrect && flags.negativeMarking) {
      score = -Math.round(q.maxScore * NEGATIVE_MARK_RATIO * 100) / 100;
    }
    totalScore += score;
    return { ...a, score };
  });
  if (totalScore < 0) totalScore = 0;

  const scorePercent = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const result = needsGrading
    ? 'GRADING_PENDING'
    : scorePercent >= assessment.passingScore ? 'PASS' : 'FAIL';
  const now = new Date();
  const timeTaken = (ref: Date | null) => (ref ? Math.round((now.getTime() - ref.getTime()) / 1000) : null);

  // Submit the open attempt if one exists.
  if (openAttempt) {
    const updated = await prisma.assessmentAttempt.update({
      where: { id: openAttempt.id },
      data: {
        answersJson: JSON.stringify(scoredAnswers),
        totalScore,
        maxScore,
        scorePercent,
        result,
        timeTakenSeconds: timeTaken(openAttempt.startedAt),
        submittedAt: now,
      },
    });
    await auditLearning(companyId, actor, 'AssessmentAttempt', openAttempt.id, 'SUBMIT', openAttempt, updated, `Attempt ${openAttempt.attemptNumber} scored ${scorePercent}% — ${result}`);
    // §51: approved-assessment promotion path (opt-in per assessment).
    if (result === 'PASS') {
      await promoteOnAssessmentPass({ companyId, actor, employeeId, assessmentId: parsed.data.assessmentId, attemptId: openAttempt.id });
    }
    notifyLearning(companyId, 'FEEDBACK_PENDING', {
      moduleCode: 'TRDV',
      sourceEntityType: 'AssessmentAttempt',
      sourceEntityId: openAttempt.id,
      subjectEmpId: employeeId,
      linkPath: '/learning/training-calendar',
    });
    return NextResponse.json(updated);
  }

  // No open attempt — direct submit counts as a new attempt (bounded).
  if (submittedCount >= assessment.maxAttempts) {
    return NextResponse.json({ error: `Maximum attempts reached (${assessment.maxAttempts})` }, { status: 400 });
  }
  const attempt = await prisma.assessmentAttempt.create({
    data: {
      companyId,
      assessmentId: parsed.data.assessmentId,
      employeeId,
      attemptNumber: attempts.length + 1,
      answersJson: JSON.stringify(scoredAnswers),
      totalScore,
      maxScore,
      scorePercent,
      result,
      timeTakenSeconds: parsed.data.startedAt ? timeTaken(parsed.data.startedAt) : null,
      submittedAt: now,
    },
  });

  await auditLearning(companyId, actor, 'AssessmentAttempt', attempt.id, 'SUBMIT', null, attempt, `Attempt ${attempt.attemptNumber} scored ${scorePercent}% — ${result}`);
  if (result === 'PASS') {
    await promoteOnAssessmentPass({ companyId, actor, employeeId, assessmentId: parsed.data.assessmentId, attemptId: attempt.id });
  }
  return NextResponse.json(attempt, { status: 201 });
}

/**
 * PATCH { attemptId, scores: [{ questionId, score }] } — §24 manual grading.
 * Admin/trainer supplies scores for the unscored (score=null) answers; the
 * attempt is re-totalled and gets its final PASS/FAIL result.
 */
export async function PATCH(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json().catch(() => null);
  const attemptId = Number(body?.attemptId);
  const scores: { questionId: number; score: number }[] = Array.isArray(body?.scores) ? body.scores : [];
  if (!attemptId || scores.length === 0) {
    return NextResponse.json({ error: 'attemptId and scores are required' }, { status: 400 });
  }

  const attempt = await prisma.assessmentAttempt.findFirst({
    where: { id: attemptId, companyId, deletedAt: null },
    include: { assessment: { select: { passingScore: true } } },
  });
  if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

  // §4/§24: HR/Admin or the schedule's assigned trainer may grade.
  if (!(await canGradeAssessment(request, companyId, attempt.assessmentId, actor))) {
    return NextResponse.json({ error: 'Only HR or the assigned trainer may grade this assessment' }, { status: 403 });
  }
  if (attempt.result !== 'GRADING_PENDING') {
    return NextResponse.json({ error: `Attempt is ${attempt.result} — nothing to grade` }, { status: 409 });
  }

  let answers: { questionId: number; answer: string; score: number | null }[] = [];
  try { answers = JSON.parse(attempt.answersJson ?? '[]'); } catch { /* ignore */ }
  const scoreMap = new Map(scores.map((s) => [s.questionId, s.score]));

  // Cap manual scores at each question's maxScore.
  const questions = await prisma.questionBank.findMany({
    where: { id: { in: answers.map((a) => a.questionId) }, companyId, deletedAt: null },
    select: { id: true, maxScore: true },
  });
  const maxOf = new Map(questions.map((q) => [q.id, q.maxScore]));

  let totalScore = 0;
  let pending = false;
  const graded = answers.map((a) => {
    let score = a.score;
    if (score == null) {
      const s = scoreMap.get(a.questionId);
      if (s == null) { pending = true; score = null; }
      else score = Math.min(Math.max(0, s), maxOf.get(a.questionId) ?? s);
    }
    if (typeof score === 'number') totalScore += score;
    return { ...a, score };
  });
  if (pending) {
    return NextResponse.json({ error: 'Scores missing for some questions' }, { status: 400 });
  }
  if (totalScore < 0) totalScore = 0;

  const scorePercent = attempt.maxScore > 0 ? Math.round((totalScore / attempt.maxScore) * 100) : 0;
  const result = scorePercent >= attempt.assessment.passingScore ? 'PASS' : 'FAIL';

  const updated = await prisma.assessmentAttempt.update({
    where: { id: attemptId },
    data: { answersJson: JSON.stringify(graded), totalScore, scorePercent, result },
  });

  await auditLearning(companyId, actor, 'AssessmentAttempt', attemptId, 'GRADE', attempt, updated, `Manual grading → ${scorePercent}% ${result}`);
  if (result === 'PASS') {
    await promoteOnAssessmentPass({ companyId, actor, employeeId: attempt.employeeId, assessmentId: attempt.assessmentId, attemptId });
  }
  return NextResponse.json(updated);
}
