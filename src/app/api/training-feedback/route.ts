import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { trainingFeedbackSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning } from '@/lib/learning/shared';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const scheduleId = searchParams.get('scheduleId') ?? '';
  const employeeId = searchParams.get('employeeId') ?? '';
  const maxRating = searchParams.get('maxRating') ?? ''; // e.g. 3 → low-scoring feedback

  // §46: scheduleId/employeeId filters — no filter returns all company feedback.
  const data = await prisma.trainingFeedback.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(scheduleId ? { trainingScheduleId: parseInt(scheduleId) } : {}),
      ...(employeeId ? { employeeId: parseInt(employeeId) } : {}),
      ...(maxRating ? { overallRating: { lte: parseInt(maxRating) } } : {}),
    },
    orderBy: { submittedAt: 'desc' },
  });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = trainingFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // employeeId may be omitted on ESS self-service submissions — resolve it
  // from the session's linked employee record rather than trusting the client.
  let employeeId = parsed.data.employeeId;
  if (!employeeId) {
    const userId = Number(request.headers.get('x-user-id'));
    employeeId = userId ? (await resolveOwnEmployeeId(userId)) ?? 0 : 0;
    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required (no linked employee for this login)' }, { status: 400 });
    }
  }

  // No duplicate feedback per (schedule, employee).
  const dup = await prisma.trainingFeedback.findFirst({
    where: { companyId, trainingScheduleId: parsed.data.trainingScheduleId, employeeId, deletedAt: null },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json({ error: 'Feedback already submitted for this training' }, { status: 409 });
  }

  const record = await prisma.trainingFeedback.create({
    data: { ...parsed.data, employeeId, companyId },
  });

  await auditLearning(companyId, actor, 'TrainingFeedback', record.id, 'CREATE', null, record, 'Feedback submitted');
  return NextResponse.json(record, { status: 201 });
}
