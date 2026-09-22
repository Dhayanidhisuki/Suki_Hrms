import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { trainingAttendanceBulkSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning, canMarkAttendance } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const scheduleId = searchParams.get('scheduleId') ?? '';

  if (!scheduleId) {
    return NextResponse.json({ error: 'scheduleId is required' }, { status: 400 });
  }

  const data = await prisma.trainingAttendance.findMany({
    where: { companyId, trainingScheduleId: parseInt(scheduleId), deletedAt: null },
    orderBy: { employeeId: 'asc' },
  });

  return NextResponse.json({ data });
}

// Bulk mark attendance for a schedule (trainer/HR marks all nominees at once).
export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = trainingAttendanceBulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { trainingScheduleId, rows } = parsed.data;

  // Confirm schedule belongs to company.
  const schedule = await prisma.trainingSchedule.findFirst({
    where: { id: trainingScheduleId, companyId, deletedAt: null },
    select: { id: true, duration: true },
  });
  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });

  // §4/§22: only HR/Admin, the schedule's trainer, or its mentor may mark.
  if (!(await canMarkAttendance(request, companyId, trainingScheduleId, actor))) {
    return NextResponse.json({ error: 'Only HR, the assigned trainer, or mentor may mark attendance for this schedule' }, { status: 403 });
  }

  const now = new Date();
  const created: number[] = [];

  for (const row of rows) {
    const scheduledDuration = row.scheduledDuration ?? Number(schedule.duration ?? 0);
    const attendedDuration = row.attendedDuration ?? 0;
    const attendancePercent =
      scheduledDuration > 0
        ? Math.round((attendedDuration / scheduledDuration) * 10000) / 100
        : null;

    // Upsert: one attendance row per (schedule, employee).
    const existing = await prisma.trainingAttendance.findFirst({
      where: { companyId, trainingScheduleId, employeeId: row.employeeId, deletedAt: null },
      select: { id: true },
    });

    if (existing) {
      await prisma.trainingAttendance.update({
        where: { id: existing.id },
        data: {
          status: row.status,
          attendedDuration: attendedDuration || null,
          scheduledDuration: scheduledDuration || null,
          attendancePercent,
          markedByUserId: actor.userId,
          markedAt: now,
          remarks: row.remarks ?? null,
        },
      });
      created.push(existing.id);
    } else {
      const rec = await prisma.trainingAttendance.create({
        data: {
          companyId,
          trainingScheduleId,
          employeeId: row.employeeId,
          status: row.status,
          attendedDuration: attendedDuration || null,
          scheduledDuration: scheduledDuration || null,
          attendancePercent,
          markedByUserId: actor.userId,
          markedAt: now,
          remarks: row.remarks ?? null,
        },
      });
      created.push(rec.id);
    }
  }

  await auditLearning(companyId, actor, 'TrainingAttendance', null, 'BULK_MARK', null, { trainingScheduleId, count: created.length }, `Marked ${created.length} attendance rows`);
  return NextResponse.json({ marked: created.length });
}
