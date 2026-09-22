/**
 * POST /api/training-attendance/pull { trainingScheduleId }
 *
 * §22: pull HRMS daily attendance into training attendance — for every
 * nominated employee, look up their DailyAttendance row on the scheduled
 * date and pre-fill the training attendance status:
 *
 *   DailyAttendance.status = Present | OnDuty        → PRESENT (100%)
 *   DailyAttendance.status = HalfDay | MissingPunch  → PARTIAL (50%)
 *   DailyAttendance.status = Absent | Leave | LOP    → ABSENT
 *   no row / WeeklyOff / Holiday / Permission        → left untouched
 *
 * Only creates rows that don't exist or updates rows not yet manually
 * marked (markedByUserId null) — manual marks are never overwritten.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth, auditLearning, canMarkAttendance } from '@/lib/learning/shared';

const PRESENT_STATUSES = new Set(['PRESENT', 'ONDUTY']);
const PARTIAL_STATUSES = new Set(['HALFDAY', 'MISSINGPUNCH']);
const ABSENT_STATUSES = new Set(['ABSENT', 'LEAVE', 'LOP']);

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json().catch(() => null);
  const trainingScheduleId = Number(body?.trainingScheduleId);
  if (!trainingScheduleId) {
    return NextResponse.json({ error: 'trainingScheduleId is required' }, { status: 400 });
  }

  const schedule = await prisma.trainingSchedule.findFirst({
    where: { id: trainingScheduleId, companyId, deletedAt: null },
    select: { id: true, scheduledDate: true, duration: true },
  });
  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
  if (!schedule.scheduledDate) {
    return NextResponse.json({ error: 'Schedule has no date — cannot match daily attendance' }, { status: 400 });
  }

  // §4/§22: only HR/Admin, the schedule's trainer, or its mentor may pull.
  if (!(await canMarkAttendance(request, companyId, trainingScheduleId, actor))) {
    return NextResponse.json({ error: 'Only HR, the assigned trainer, or mentor may pull attendance for this schedule' }, { status: 403 });
  }

  const nominations = await prisma.trainingNomination.findMany({
    where: { companyId, trainingScheduleId, deletedAt: null, status: { notIn: ['REJECTED', 'CANCELLED'] } },
    select: { employeeId: true },
  });
  if (nominations.length === 0) {
    return NextResponse.json({ pulled: 0, skipped: 0, message: 'No nominations for this schedule' });
  }

  const day = new Date(schedule.scheduledDate);
  const daily = await prisma.dailyAttendance.findMany({
    where: { employeeId: { in: nominations.map((n) => n.employeeId) }, date: day },
    select: { employeeId: true, status: true, workingMinutes: true },
  });
  const dailyByEmp = new Map(daily.map((d) => [d.employeeId, d]));

  const existing = await prisma.trainingAttendance.findMany({
    where: { companyId, trainingScheduleId, deletedAt: null },
    select: { id: true, employeeId: true, markedByUserId: true },
  });
  const existingByEmp = new Map(existing.map((e) => [e.employeeId, e]));

  const schedDur = Number(schedule.duration ?? 0);
  let pulled = 0;
  let skipped = 0;

  for (const nom of nominations) {
    const d = dailyByEmp.get(nom.employeeId);
    if (!d) { skipped++; continue; }
    const st = (d.status ?? '').toUpperCase().replace(/[\s_-]/g, '');
    let status: string;
    let attended: number;
    if (PRESENT_STATUSES.has(st)) { status = 'PRESENT'; attended = schedDur; }
    else if (PARTIAL_STATUSES.has(st)) { status = 'PARTIAL'; attended = schedDur / 2; }
    else if (ABSENT_STATUSES.has(st)) { status = 'ABSENT'; attended = 0; }
    else { skipped++; continue; }

    const pct = schedDur > 0 ? Math.round((attended / schedDur) * 10000) / 100 : (status === 'PRESENT' ? 100 : status === 'PARTIAL' ? 50 : 0);
    const prior = existingByEmp.get(nom.employeeId);
    // Never overwrite a row a person already marked.
    if (prior?.markedByUserId) { skipped++; continue; }

    if (prior) {
      await prisma.trainingAttendance.update({
        where: { id: prior.id },
        data: {
          status,
          attendedDuration: attended || null,
          scheduledDuration: schedDur || null,
          attendancePercent: pct,
          remarks: `Auto-pulled from HRMS attendance (${d.status})`,
        },
      });
    } else {
      await prisma.trainingAttendance.create({
        data: {
          companyId,
          trainingScheduleId,
          employeeId: nom.employeeId,
          status,
          attendedDuration: attended || null,
          scheduledDuration: schedDur || null,
          attendancePercent: pct,
          remarks: `Auto-pulled from HRMS attendance (${d.status})`,
        },
      });
    }
    pulled++;
  }

  await auditLearning(companyId, actor, 'TrainingAttendance', null, 'PULL_HRMS', null, { trainingScheduleId, pulled, skipped }, `Pulled HRMS attendance: ${pulled} rows`);
  return NextResponse.json({ pulled, skipped });
}
