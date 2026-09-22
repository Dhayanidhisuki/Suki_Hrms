import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { trainingScheduleSchema } from '@/lib/validations/learning';

export async function GET(request: NextRequest) {
  if (!request.headers.get('x-role-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const month = searchParams.get('month');
  const year = searchParams.get('year');
  const status = searchParams.get('status');
  const trainerId = searchParams.get('trainerId');
  const venueId = searchParams.get('venueId');
  const programId = searchParams.get('programId');
  const mentorId = searchParams.get('mentorId');
  const employeeId = searchParams.get('employeeId'); // nominated employee
  const method = searchParams.get('method');
  const search = searchParams.get('search') ?? '';

  const where: Record<string, unknown> = { companyId, deletedAt: null };
  if (status) where.status = status.toUpperCase();
  if (trainerId) where.trainerId = parseInt(trainerId);
  if (venueId) where.venueId = parseInt(venueId);
  if (programId) where.trainingProgramId = parseInt(programId);
  if (mentorId) where.OR = [{ mentorId: parseInt(mentorId) }, { mentorEmployeeId: parseInt(mentorId) }];
  if (employeeId) where.nominations = { some: { employeeId: parseInt(employeeId), deletedAt: null } };
  if (method) where.method = method;
  if (search) where.title = { contains: search };
  if (month) {
    const [y, m] = month.split('-');
    const start = new Date(`${y}-${m}-01`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    where.scheduledDate = { gte: start, lt: end };
  } else if (year) {
    // §16: year view — full-year range filter.
    const y = parseInt(year);
    if (!Number.isNaN(y)) {
      where.scheduledDate = { gte: new Date(`${y}-01-01`), lt: new Date(`${y + 1}-01-01`) };
    }
  }

  const [data, total] = await Promise.all([
    prisma.trainingSchedule.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { scheduledDate: 'asc' },
      include: {
        trainingProgram: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.trainingSchedule.count({ where }),
  ]);

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  if (!request.headers.get('x-role-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const body = await request.json();
  const parsed = trainingScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { trainingProgramId, trainerId, venueId, scheduledDate, startTime, endTime, mentorId, resourceIds } = parsed.data;

  const program = await prisma.trainingProgram.findFirst({
    where: { id: trainingProgramId, companyId, deletedAt: null },
  });
  if (!program) {
    return NextResponse.json({ error: 'Invalid training program' }, { status: 400 });
  }

  // §17: schedule-level mentor must be an active TrainingMentor master record.
  if (mentorId) {
    const mentor = await prisma.trainingMentor.findFirst({
      where: { id: mentorId, companyId, isActive: true, deletedAt: null },
    });
    if (!mentor) {
      return NextResponse.json({ error: 'Invalid mentor (TrainingMentor master record not found)' }, { status: 400 });
    }
  }

  const date = scheduledDate ? new Date(scheduledDate) : undefined;

  // Time-overlap conflict check (BRD §19, §39, §51): a trainer/venue may host
  // multiple sessions on the same date only when time ranges don't overlap.
  // Overlap = newStart < existingEnd AND newEnd > existingStart. Sessions
  // without times still conflict at the date level.
  const overlaps = (aStart?: string | null, aEnd?: string | null, bStart?: string | null, bEnd?: string | null) => {
    if (!aStart || !aEnd || !bStart || !bEnd) return true; // can't compare → conservative
    return aStart < bEnd && aEnd > bStart;
  };

  if (trainerId && date) {
    const sameDay = await prisma.trainingSchedule.findMany({
      where: { companyId, deletedAt: null, trainerId, scheduledDate: date, status: { not: 'CANCELLED' } },
      select: { id: true, startTime: true, endTime: true, title: true },
    });
    const conflict = sameDay.find((s) => overlaps(startTime, endTime, s.startTime, s.endTime));
    if (conflict) {
      return NextResponse.json(
        { error: `Trainer already scheduled ${conflict.startTime ?? ''}–${conflict.endTime ?? ''} on this date (${conflict.title ?? `#${conflict.id}`})` },
        { status: 409 }
      );
    }
  }

  if (venueId && date) {
    const sameDay = await prisma.trainingSchedule.findMany({
      where: { companyId, deletedAt: null, venueId, scheduledDate: date, status: { not: 'CANCELLED' } },
      select: { id: true, startTime: true, endTime: true, title: true },
    });
    const conflict = sameDay.find((s) => overlaps(startTime, endTime, s.startTime, s.endTime));
    if (conflict) {
      return NextResponse.json(
        { error: `Venue already booked ${conflict.startTime ?? ''}–${conflict.endTime ?? ''} on this date (${conflict.title ?? `#${conflict.id}`})` },
        { status: 409 }
      );
    }
  }

  // §19: resource booking — each booked TrainingResource must exist, be
  // bookable, and have remaining quantity across overlapping same-day sessions.
  const requestedResources: number[] = (() => {
    if (!resourceIds) return [];
    try {
      const arr = JSON.parse(resourceIds);
      return Array.isArray(arr) ? arr.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
    } catch { return []; }
  })();
  if (requestedResources.length > 0) {
    if (!date) {
      return NextResponse.json({ error: 'A scheduled date is required to book resources' }, { status: 400 });
    }
    const resources = await prisma.trainingResource.findMany({
      where: { id: { in: requestedResources }, companyId, isActive: true, deletedAt: null },
    });
    if (resources.length !== requestedResources.length) {
      return NextResponse.json({ error: 'One or more resources are invalid' }, { status: 400 });
    }
    const retired = resources.find((r) => r.status === 'RETIRED' || r.status === 'MAINTENANCE');
    if (retired) {
      return NextResponse.json({ error: `Resource "${retired.name}" is ${retired.status.toLowerCase()}` }, { status: 409 });
    }
    const sameDay = await prisma.trainingSchedule.findMany({
      where: { companyId, deletedAt: null, scheduledDate: date, status: { not: 'CANCELLED' }, resourceIds: { not: null } },
      select: { id: true, startTime: true, endTime: true, title: true, resourceIds: true },
    });
    const overlapping = sameDay.filter((s) => overlaps(startTime, endTime, s.startTime, s.endTime));
    for (const res of resources) {
      const used = overlapping.filter((s) => {
        try { return (JSON.parse(s.resourceIds ?? '[]') as number[]).includes(res.id); } catch { return false; }
      }).length;
      if (used >= res.quantity) {
        return NextResponse.json(
          { error: `Resource "${res.name}" is fully booked on this date/time` },
          { status: 409 }
        );
      }
    }
  }

  const record = await prisma.trainingSchedule.create({
    data: {
      ...parsed.data,
      companyId,
      status: parsed.data.status.toUpperCase(),
      scheduledDate: date ?? null,
      startTime: startTime ?? null,
      endTime: endTime ?? null,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
