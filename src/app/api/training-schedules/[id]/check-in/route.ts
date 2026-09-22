/**
 * POST /api/training-schedules/[id]/check-in
 *   — ESS self check-in (BRD §22). The logged-in employee marks themselves
 *   present for a training they are nominated for. Works for QR check-in too:
 *   the QR code encodes /ess/my-trainings?checkin=<scheduleId>, and the ESS
 *   page calls this endpoint.
 *
 *   Rules:
 *   - caller must have an approved/nominated nomination on the schedule
 *   - check-in is allowed only on the scheduled date
 *   - idempotent: a second call returns the existing attendance row
 *   - checked in after startTime + 15 min grace → marked LATE
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { auditLearning } from '@/lib/learning/shared';

const LATE_GRACE_MINUTES = 15;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { companyId } = scope;
  const { id } = await params;
  const scheduleId = parseInt(id);

  const employeeId = await resolveOwnEmployeeId(userId);
  if (!employeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const schedule = await prisma.trainingSchedule.findFirst({
    where: { id: scheduleId, companyId, deletedAt: null },
    select: { id: true, status: true, scheduledDate: true, startTime: true, title: true },
  });
  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
  if (!['SCHEDULED', 'IN_PROGRESS'].includes(schedule.status)) {
    return NextResponse.json({ error: `Check-in not allowed — training is ${schedule.status}` }, { status: 409 });
  }

  // Same-day only.
  const today = new Date().toISOString().slice(0, 10);
  const schedDate = schedule.scheduledDate?.toISOString().slice(0, 10);
  if (schedDate !== today) {
    return NextResponse.json({ error: `Check-in opens on the training date (${schedDate ?? 'unscheduled'})` }, { status: 409 });
  }

  const nomination = await prisma.trainingNomination.findFirst({
    where: { trainingScheduleId: scheduleId, employeeId, companyId, deletedAt: null, status: { in: ['APPROVED', 'NOMINATED'] } },
  });
  if (!nomination) {
    return NextResponse.json({ error: 'You are not an approved nominee for this training' }, { status: 403 });
  }

  const existing = await prisma.trainingAttendance.findFirst({
    where: { trainingScheduleId: scheduleId, employeeId, companyId, deletedAt: null },
  });
  if (existing) {
    return NextResponse.json({ data: existing, message: `Already checked in (${existing.status})` });
  }

  // Late if past startTime + grace.
  let status = 'PRESENT';
  if (schedule.startTime) {
    const [h, m] = schedule.startTime.split(':').map(Number);
    const start = new Date();
    start.setHours(h, m + LATE_GRACE_MINUTES, 0, 0);
    if (new Date() > start) status = 'LATE';
  }

  const record = await prisma.trainingAttendance.create({
    data: {
      companyId,
      trainingScheduleId: scheduleId,
      employeeId,
      nominationId: nomination.id,
      status,
      markedByUserId: userId,
      markedAt: new Date(),
      remarks: 'Self check-in',
    },
  });

  await auditLearning(companyId, { userId, employeeId, source: 'user', ipAddress: null }, 'TrainingAttendance', record.id, 'SELF_CHECK_IN', null, record, `Schedule ${scheduleId}`);
  return NextResponse.json({ data: record, message: `Checked in as ${status}` }, { status: 201 });
}
