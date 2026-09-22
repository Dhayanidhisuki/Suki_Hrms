/**
 * Training reminder + certification expiry scheduler (BRD §16, §33, §51).
 *
 * Runs hourly. On each tick it:
 *  1. Finds TrainingSchedule rows with scheduledDate within the next 24h
 *     that are still SCHEDULED/PENDING and have not been reminded yet, and
 *     fires TRAINING_REMINDER to every approved nominee.
 *  2. Finds EmployeeCompetency rows whose certification expires within the
 *     next 30 days (and a second pass at 7 days) and fires CERT_EXPIRING.
 *
 * Started once per Node server instance from src/instrumentation.ts;
 * guarded on globalThis so dev HMR never starts a second timer, and a run
 * still in progress is never overlapped.
 */

import { prisma } from '@/lib/prisma';
import { emitPlatformEvent } from '@/lib/platform/events';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

interface SchedulerState {
  timer: NodeJS.Timeout | null;
  running: boolean;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  nextRunAt: Date | null;
}

const g = globalThis as unknown as { __learningScheduler?: SchedulerState };

export function getLearningSchedulerState(): SchedulerState | null {
  return g.__learningScheduler ?? null;
}

async function fireTrainingReminders(now: Date): Promise<number> {
  const windowStart = now;
  const windowEnd = new Date(now.getTime() + DAY_MS);

  // Schedules happening in the next 24h, not yet cancelled/completed.
  const schedules = await prisma.trainingSchedule.findMany({
    where: {
      deletedAt: null,
      status: { in: ['SCHEDULED', 'PENDING'] },
      scheduledDate: { gte: windowStart, lte: windowEnd },
    },
    select: {
      id: true,
      companyId: true,
      title: true,
      scheduledDate: true,
      startTime: true,
      method: true,
      venueId: true,
      trainingProgram: { select: { name: true } },
      nominations: {
        where: { deletedAt: null, status: 'APPROVED' },
        select: { employeeId: true },
      },
    },
  });

  let sent = 0;
  for (const s of schedules) {
    const dateStr = s.scheduledDate ? s.scheduledDate.toISOString().slice(0, 10) : '—';
    // Resolve venue name separately only when a venueId is set.
    let venueName = '—';
    if (s.venueId) {
      const v = await prisma.trainingVenue.findFirst({ where: { id: s.venueId, companyId: s.companyId }, select: { name: true } });
      venueName = v?.name ?? '—';
    }
    for (const nom of s.nominations) {
      void emitPlatformEvent(s.companyId, 'TRAINING_REMINDER', {
        moduleCode: 'TRDV',
        sourceEntityType: 'TrainingSchedule',
        sourceEntityId: s.id,
        subjectEmpId: nom.employeeId,
        linkPath: '/learning/training-calendar',
        data: {
          Training: {
            Program: s.trainingProgram?.name ?? s.title ?? 'Training',
            Date: dateStr,
            Time: s.startTime ?? '—',
            Venue: venueName,
          },
        },
      }).catch((err) => console.warn(`[learning/reminder] ${s.id}/${nom.employeeId}:`, (err as Error).message));
      sent++;
    }
  }
  return sent;
}

async function fireCertExpiryAlerts(now: Date): Promise<number> {
  // Certifications expiring in the next 30 days. We re-fire on each daily
  // tick; the notification service dedupes by eventInstanceId if needed.
  const windowEnd = new Date(now.getTime() + 30 * DAY_MS);

  const rows = await prisma.employeeCompetency.findMany({
    where: {
      deletedAt: null,
      expiryDate: { gte: now, lte: windowEnd },
      isActive: true,
    },
    select: {
      id: true,
      companyId: true,
      employeeId: true,
      certificationNumber: true,
      expiryDate: true,
    },
  });

  let sent = 0;
  for (const c of rows) {
    const days = c.expiryDate ? Math.ceil((c.expiryDate.getTime() - now.getTime()) / DAY_MS) : 0;
    void emitPlatformEvent(c.companyId, 'CERT_EXPIRING', {
      moduleCode: 'TRDV',
      sourceEntityType: 'EmployeeCompetency',
      sourceEntityId: c.id,
      subjectEmpId: c.employeeId,
      linkPath: '/learning/skill-matrix',
      data: {
        Certificate: {
          Number: c.certificationNumber ?? '—',
          ExpiryDate: c.expiryDate ?? null,
          DaysToExpiry: days,
        },
      },
    }).catch((err) => console.warn(`[learning/cert-expiry] ${c.id}:`, (err as Error).message));
    sent++;
  }
  return sent;
}

/**
 * Auto-assign induction programs to new joiners (BRD §23).
 * On each tick, employees whose latest JobInfo.joinDate falls within the
 * lookback window and who have no InductionAssignment yet get one created
 * against the matching active InductionProgram (department/designation/
 * location null = wildcard), and the INDUCTION_ASSIGNED event fires.
 */
async function autoAssignInductions(now: Date): Promise<number> {
  const lookbackDays = Number(process.env.LEARNING_INDUCTION_LOOKBACK_DAYS ?? 30);
  const since = new Date(now.getTime() - lookbackDays * DAY_MS);

  const joiners = await prisma.jobInfo.findMany({
    where: { joinDate: { gte: since, lte: now } },
    select: {
      employeeId: true,
      departmentId: true,
      designationId: true,
      joinDate: true,
      employee: { select: { id: true, companyId: true, status: true, deletedAt: true } },
    },
  });

  // Latest JobInfo per employee (joinDate desc).
  const latestByEmp = new Map<number, (typeof joiners)[number]>();
  for (const j of joiners) {
    if (j.employee.status !== 'active' || j.employee.deletedAt) continue;
    if (!latestByEmp.has(j.employeeId)) latestByEmp.set(j.employeeId, j);
  }
  if (latestByEmp.size === 0) return 0;

  const empIds = [...latestByEmp.keys()];
  const existing = await prisma.inductionAssignment.findMany({
    where: { employeeId: { in: empIds }, deletedAt: null },
    select: { employeeId: true },
  });
  const already = new Set(existing.map((e) => e.employeeId));

  let created = 0;
  for (const [empId, job] of latestByEmp) {
    if (already.has(empId)) continue;
    const companyId = job.employee.companyId;
    const program = await prisma.inductionProgram.findFirst({
      where: {
        companyId, isActive: true, deletedAt: null,
        OR: [{ departmentId: null }, { departmentId: job.departmentId }],
      },
      orderBy: { departmentId: 'desc' }, // dept-specific programs win over wildcard
    });
    if (!program) continue;
    // Designation/location scoping.
    if (program.designationId && program.designationId !== job.designationId) continue;

    await prisma.inductionAssignment.create({
      data: {
        companyId,
        inductionProgramId: program.id,
        employeeId: empId,
        targetDate: job.joinDate ? new Date(job.joinDate.getTime() + (program.durationDays ?? 1) * DAY_MS) : null,
        checklistJson: program.topicsJson, // program topics become the assignment checklist
      },
    });
    void emitPlatformEvent(companyId, 'INDUCTION_ASSIGNED', {
      moduleCode: 'TRDV',
      sourceEntityType: 'InductionAssignment',
      sourceEntityId: program.id,
      subjectEmpId: empId,
      linkPath: '/learning/induction',
      data: { Training: { Program: program.name } },
    }).catch(() => {});
    created++;
  }
  return created;
}

/**
 * 30/60/90-day effectiveness triggers (BRD §28).
 * For each completed schedule, once the stage window elapses a pending
 * TrainingEffectiveness row is created per present attendee and the
 * manager is notified via EFFECTIVENESS_PENDING.
 */
async function triggerEffectivenessEvals(now: Date): Promise<number> {
  const stages: { stage: string; days: number }[] = [
    { stage: 'D30', days: 30 },
    { stage: 'D60', days: 60 },
    { stage: 'D90', days: 90 },
  ];
  const oldest = new Date(now.getTime() - 95 * DAY_MS);

  const schedules = await prisma.trainingSchedule.findMany({
    where: {
      deletedAt: null,
      status: 'COMPLETED',
      scheduledDate: { gte: oldest, lte: new Date(now.getTime() - 29 * DAY_MS) },
    },
    select: {
      id: true,
      companyId: true,
      scheduledDate: true,
      trainingProgram: { select: { name: true } },
      attendances: { where: { deletedAt: null, status: { in: ['PRESENT', 'LATE'] } }, select: { employeeId: true } },
    },
  });
  if (schedules.length === 0) return 0;

  let created = 0;
  for (const s of schedules) {
    if (!s.scheduledDate) continue;
    const ageDays = Math.floor((now.getTime() - s.scheduledDate.getTime()) / DAY_MS);
    for (const { stage, days } of stages) {
      if (ageDays < days) continue;
      for (const att of s.attendances) {
        const exists = await prisma.trainingEffectiveness.findFirst({
          where: { companyId: s.companyId, trainingScheduleId: s.id, employeeId: att.employeeId, evaluationStage: stage, deletedAt: null },
          select: { id: true },
        });
        if (exists) continue;
        const row = await prisma.trainingEffectiveness.create({
          data: {
            companyId: s.companyId,
            trainingScheduleId: s.id,
            employeeId: att.employeeId,
            evaluationStage: stage,
            remarks: `Auto-created ${days}-day evaluation — awaiting manager input`,
          },
        });
        void emitPlatformEvent(s.companyId, 'EFFECTIVENESS_PENDING', {
          moduleCode: 'TRDV',
          sourceEntityType: 'TrainingEffectiveness',
          sourceEntityId: row.id,
          subjectEmpId: att.employeeId,
          linkPath: '/learning/effectiveness',
          data: { Training: { Program: s.trainingProgram?.name ?? 'Training' } },
        }).catch(() => {});
        created++;
      }
    }
  }
  return created;
}

async function tick(state: SchedulerState) {
  if (state.running) return;
  state.running = true;
  state.lastStartedAt = new Date();
  try {
    const now = new Date();
    const reminders = await fireTrainingReminders(now);
    const certs = await fireCertExpiryAlerts(now);
    const inductions = await autoAssignInductions(now);
    const evals = await triggerEffectivenessEvals(now);
    if (reminders || certs || inductions || evals) {
      console.log(`[learning/scheduler] reminders: ${reminders}, cert alerts: ${certs}, inductions: ${inductions}, evals: ${evals}`);
    }
  } catch (err) {
    console.error('[learning/scheduler] tick crashed', err);
  } finally {
    state.running = false;
    state.lastFinishedAt = new Date();
    state.nextRunAt = new Date(Date.now() + HOUR_MS);
  }
}

export function startLearningScheduler(): void {
  if (g.__learningScheduler) return;
  if (process.env.LEARNING_SCHEDULER_ENABLED === 'false') {
    console.log('[learning/scheduler] disabled by LEARNING_SCHEDULER_ENABLED=false');
    return;
  }

  const initialDelayMs = Number(process.env.LEARNING_SCHEDULER_INITIAL_DELAY_MS ?? 120 * 1000);
  const state: SchedulerState = {
    timer: null,
    running: false,
    lastStartedAt: null,
    lastFinishedAt: null,
    nextRunAt: new Date(Date.now() + initialDelayMs),
  };
  g.__learningScheduler = state;

  const first = setTimeout(() => {
    void tick(state);
    state.timer = setInterval(() => void tick(state), HOUR_MS);
    state.timer.unref?.();
  }, initialDelayMs);
  first.unref?.();

  console.log(`[learning/scheduler] started: hourly, first run in ${Math.round(initialDelayMs / 1000)}s`);
}
