import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { trainingNominationSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning, notifyLearning, isLearningAdmin, callerEmployeeId } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const status = searchParams.get('status') ?? '';
  const scheduleId = searchParams.get('scheduleId') ?? '';
  const employeeId = searchParams.get('employeeId') ?? '';
  const reason = searchParams.get('reason') ?? '';
  const programId = searchParams.get('programId') ?? '';
  const myTeam = searchParams.get('myTeam') === '1';

  // §4/§20 "My Team" scope: reportees (Employee.reportingManagerId = caller)
  // plus nominations the caller raised as the nominating manager.
  let teamScope: Record<string, unknown> | null = null;
  if (myTeam) {
    const callerEmpId = await callerEmployeeId(companyId, actor);
    if (callerEmpId) {
      const team = await prisma.employee.findMany({
        where: { companyId, reportingManagerId: callerEmpId, deletedAt: null },
        select: { id: true },
      });
      teamScope = {
        OR: [
          { employeeId: { in: team.map((t) => t.id) } },
          { managerEmployeeId: callerEmpId },
        ],
      };
    } else {
      teamScope = { employeeId: -1 }; // caller is not an employee → empty result
    }
  }

  const where = {
    companyId,
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(scheduleId ? { trainingScheduleId: parseInt(scheduleId) } : {}),
    ...(employeeId ? { employeeId: parseInt(employeeId) } : {}),
    ...(reason ? { reason } : {}),
    ...(programId ? { trainingSchedule: { trainingProgramId: parseInt(programId) } } : {}),
    ...(teamScope ?? {}),
  };

  const [data, total] = await Promise.all([
    prisma.trainingNomination.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.trainingNomination.count({ where }),
  ]);

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = trainingNominationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Business rule (BRD §51): block inactive/terminated employees.
  const employee = await prisma.employee.findFirst({
    where: { id: parsed.data.employeeId, companyId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found in this company' }, { status: 404 });
  }
  if (employee.status && /terminat|inact|exit|resign/i.test(employee.status)) {
    return NextResponse.json({ error: 'Cannot nominate an inactive/terminated employee' }, { status: 400 });
  }

  // Business rule: no duplicate nomination per schedule.
  const dup = await prisma.trainingNomination.findFirst({
    where: { companyId, trainingScheduleId: parsed.data.trainingScheduleId, employeeId: parsed.data.employeeId, deletedAt: null },
  });
  if (dup) {
    return NextResponse.json({ error: 'Employee already nominated for this schedule' }, { status: 409 });
  }

  // Business rule: max participants check.
  const schedule = await prisma.trainingSchedule.findFirst({
    where: { id: parsed.data.trainingScheduleId, companyId, deletedAt: null },
    select: { id: true, maxParticipants: true, title: true, scheduledDate: true, startTime: true, endTime: true },
  });
  if (!schedule) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
  }
  if (schedule.maxParticipants) {
    const count = await prisma.trainingNomination.count({
      where: { companyId, trainingScheduleId: schedule.id, deletedAt: null, status: { in: ['PENDING', 'APPROVED', 'NOMINATED'] } },
    });
    if (count >= schedule.maxParticipants) {
      return NextResponse.json({ error: 'Maximum participants reached for this schedule' }, { status: 400 });
    }
  }

  // §51 policy gate: nominationCutoffDays — nominations must be submitted at
  // least N days before the schedule date. Admin may pass ?override=1.
  if (schedule.scheduledDate) {
    const policy = await prisma.trainingPolicy.findFirst({
      where: { companyId, isActive: true, deletedAt: null },
      orderBy: { id: 'desc' },
      select: { nominationCutoffDays: true },
    });
    const cutoff = policy?.nominationCutoffDays ?? null;
    if (cutoff != null && cutoff > 0) {
      const daysUntil = Math.floor((schedule.scheduledDate.getTime() - Date.now()) / 86400000);
      if (daysUntil < cutoff && !(request.nextUrl.searchParams.get('override') === '1' && (await isLearningAdmin(request)))) {
        return NextResponse.json(
          { error: `Nomination cutoff: must nominate at least ${cutoff} days before the session (${Math.max(0, daysUntil)} days left)` },
          { status: 409 }
        );
      }
    }
  }

  // Business rule (BRD §39): warn on employee double-booking — already
  // nominated for another training on the same date with overlapping times.
  if (schedule.scheduledDate) {
    const otherNoms = await prisma.trainingNomination.findMany({
      where: {
        companyId,
        employeeId: parsed.data.employeeId,
        deletedAt: null,
        status: { in: ['PENDING', 'APPROVED', 'NOMINATED'] },
        trainingScheduleId: { not: schedule.id },
        trainingSchedule: { scheduledDate: schedule.scheduledDate, deletedAt: null, status: { not: 'CANCELLED' } },
      },
      include: { trainingSchedule: { select: { title: true, startTime: true, endTime: true } } },
    });
    const overlap = otherNoms.find((n) => {
      const s = n.trainingSchedule;
      if (!schedule.startTime || !schedule.endTime || !s?.startTime || !s?.endTime) return true;
      return schedule.startTime < s.endTime && schedule.endTime > s.startTime;
    });
    if (overlap) {
      return NextResponse.json(
        { error: `Employee already nominated for "${overlap.trainingSchedule?.title ?? 'another training'}" on this date` },
        { status: 409 }
      );
    }
  }

  const record = await prisma.trainingNomination.create({
    data: { ...parsed.data, companyId, currentStageOrder: 0 },
  });

  await auditLearning(companyId, actor, 'TrainingNomination', record.id, 'CREATE', null, record, 'Nomination submitted');
  notifyLearning(companyId, 'NOMINATION_SUBMITTED', {
    moduleCode: 'TRDV',
    sourceEntityType: 'TrainingNomination',
    sourceEntityId: record.id,
    subjectEmpId: record.employeeId,
    linkPath: `/learning/nominations`,
  });

  return NextResponse.json(record, { status: 201 });
}
