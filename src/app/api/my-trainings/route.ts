/**
 * GET /api/my-trainings — ESS self-service view (BRD §36).
 *
 * Resolves the logged-in employee from the session (Employee.userId via
 * x-user-id, same as /api/workforce/mispunch?scope=mine) and returns
 * everything the employee needs on one page:
 *   - nominations: their TrainingNomination rows + schedule details
 *   - upcoming: schedules they're nominated for that are still SCHEDULED
 *   - history: TrainingHistory rows from completed trainings
 *   - pendingFeedback: completed trainings without a submitted feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const employeeId = await resolveOwnEmployeeId(userId);
  if (!employeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const [nominations, history, feedback, myRequests] = await Promise.all([
    prisma.trainingNomination.findMany({
      where: { companyId, employeeId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.trainingHistory.findMany({
      where: { companyId, employeeId, deletedAt: null },
      orderBy: { scheduledDate: 'desc' },
    }),
    prisma.trainingFeedback.findMany({
      where: { companyId, employeeId, deletedAt: null },
      select: { trainingScheduleId: true },
    }),
    // §48/§53: the employee's own training requests.
    prisma.trainingNeedRequest.findMany({
      where: { companyId, employeeId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // TrainingNeedRequest has no ORM relations — resolve names in one query each.
  const compIds = [...new Set(myRequests.map((r) => r.competencyId).filter((x): x is number => x != null))];
  const progIds = [...new Set(myRequests.map((r) => r.trainingProgramId).filter((x): x is number => x != null))];
  const [reqComps, reqProgs] = await Promise.all([
    compIds.length ? prisma.competency.findMany({ where: { id: { in: compIds } }, select: { id: true, name: true } }) : [],
    progIds.length ? prisma.trainingProgram.findMany({ where: { id: { in: progIds } }, select: { id: true, name: true } }) : [],
  ]);
  const compName = new Map(reqComps.map((c) => [c.id, c.name]));
  const progName = new Map(reqProgs.map((p) => [p.id, p.name]));
  const requests = myRequests.map((r) => ({
    ...r,
    competencyName: r.competencyId != null ? compName.get(r.competencyId) ?? null : null,
    programName: r.trainingProgramId != null ? progName.get(r.trainingProgramId) ?? null : null,
  }));

  // Resolve schedule details for nominations.
  const scheduleIds = nominations.map((n) => n.trainingScheduleId);
  const schedules = await prisma.trainingSchedule.findMany({
    where: { id: { in: scheduleIds }, companyId },
    include: { trainingProgram: { select: { name: true } } },
  });
  const scheduleMap = new Map(schedules.map((s) => [s.id, s]));

  const nominatedSchedules = nominations.map((n) => ({
    ...n,
    schedule: scheduleMap.get(n.trainingScheduleId) ?? null,
  }));

  const upcoming = nominatedSchedules.filter(
    (n) => n.schedule && n.schedule.status === 'SCHEDULED' && n.schedule.scheduledDate && new Date(n.schedule.scheduledDate) >= new Date()
  );

  // Trainings completed without feedback → FEEDBACK_PENDING.
  const feedbackGiven = new Set(feedback.map((f) => f.trainingScheduleId));
  const pendingFeedback = nominatedSchedules.filter(
    (n) => n.schedule && n.schedule.status === 'COMPLETED' && !feedbackGiven.has(n.trainingScheduleId)
  );

  // §51: mandatory trainings must surface in the employee's pending list.
  const mandatoryPending = nominatedSchedules.filter(
    (n) => n.reason === 'MANDATORY' && n.schedule && n.schedule.status !== 'COMPLETED' && n.status !== 'REJECTED' && n.status !== 'CANCELLED'
  );

  // §13/§51 policy enforcement surfaced to the employee:
  //  - minTrainingHoursPerYear → completed hours this year vs the requirement
  //  - mandatoryTrainingGraceDays → mandatory sessions past date+grace flagged overdue
  const policy = await prisma.trainingPolicy.findFirst({
    where: { companyId, isActive: true, deletedAt: null },
    orderBy: { id: 'desc' },
    select: { minTrainingHoursPerYear: true, mandatoryTrainingGraceDays: true },
  });
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const completedHours = history
    .filter((h) => h.result === 'COMPLETED' && h.scheduledDate && h.scheduledDate >= yearStart)
    .reduce((s, h) => s + Number(h.duration ?? 0), 0);
  const minHours = policy?.minTrainingHoursPerYear ?? null;
  const grace = policy?.mandatoryTrainingGraceDays ?? null;
  const overdueMandatory = grace != null
    ? mandatoryPending.filter((n) => {
        const d = n.schedule?.scheduledDate;
        return d && Date.now() > new Date(d).getTime() + grace * 86400000;
      })
    : [];

  // §4/§17: schedules where the caller is the assigned mentor — so they can
  // submit post-training evaluations from their own ESS view.
  const myMentorRows = await prisma.trainingMentor.findMany({
    where: { companyId, employeeId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  const mentorSchedules = await prisma.trainingSchedule.findMany({
    where: {
      companyId, deletedAt: null,
      OR: [
        { mentorEmployeeId: employeeId },
        ...(myMentorRows.length ? [{ mentorId: { in: myMentorRows.map((m) => m.id) } }] : []),
      ],
    },
    include: { trainingProgram: { select: { name: true } } },
    orderBy: { scheduledDate: 'desc' },
  });
  const mentorScheduleIds = mentorSchedules.map((s) => s.id);
  const [mentorNoms, mentorEvals] = await Promise.all([
    mentorScheduleIds.length
      ? prisma.trainingNomination.findMany({
          where: { companyId, trainingScheduleId: { in: mentorScheduleIds }, deletedAt: null, status: { notIn: ['REJECTED', 'CANCELLED'] } },
        })
      : [],
    mentorScheduleIds.length
      ? prisma.trainingEffectiveness.findMany({
          where: { companyId, trainingScheduleId: { in: mentorScheduleIds }, deletedAt: null },
        })
      : [],
  ]);
  const nomEmpIds = [...new Set(mentorNoms.map((n) => n.employeeId))];
  const empRows = nomEmpIds.length
    ? await prisma.employee.findMany({ where: { id: { in: nomEmpIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const empName = new Map(empRows.map((e) => [e.id, `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim()]));
  const evalKey = new Set(mentorEvals.map((e) => `${e.trainingScheduleId}:${e.employeeId}`));
  // §47: the 5-point scale from the Training Rating master for ESS forms
  // (feedback + mentor evaluation). DropdownMaster is a global lookup.
  const ratingRows = await prisma.dropdownMaster.findMany({
    where: { category: 'TRAINING_RATING', deletedAt: null, isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { label: true, value: true },
  });
  const mentoring = mentorSchedules.map((s) => ({
    schedule: s,
    mentees: mentorNoms
      .filter((n) => n.trainingScheduleId === s.id)
      .map((n) => ({
        employeeId: n.employeeId,
        employeeName: empName.get(n.employeeId) ?? `Employee ${n.employeeId}`,
        evaluated: evalKey.has(`${s.id}:${n.employeeId}`),
      })),
  }));

  return NextResponse.json({
    data: {
      nominations: nominatedSchedules, upcoming, history, pendingFeedback, mandatoryPending, myRequests: requests, mentoring,
      ratingScale: ratingRows.map((r) => ({ value: Number(r.value), label: r.label })),
      // additive policy block — older clients can ignore it.
      policy: {
        minTrainingHoursPerYear: minHours,
        completedHoursThisYear: Math.round(completedHours * 100) / 100,
        hoursRemaining: minHours != null ? Math.max(0, Math.round((minHours - completedHours) * 100) / 100) : null,
        mandatoryTrainingGraceDays: grace,
        overdueMandatoryIds: overdueMandatory.map((n) => n.id),
      },
    },
  });
}
