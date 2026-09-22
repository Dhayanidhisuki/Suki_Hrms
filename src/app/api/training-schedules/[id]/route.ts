import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { trainingScheduleSchema } from '@/lib/validations/learning';
import { isLearningAdmin } from '@/lib/learning/shared';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!request.headers.get('x-role-id')) return unauthorized();

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const { id } = await params;
  const record = await prisma.trainingSchedule.findFirst({
    where: { id: parseInt(id), companyId, deletedAt: null },
    include: {
      trainingProgram: { select: { id: true, code: true, name: true } },
    },
  });
  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(record);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!request.headers.get('x-role-id')) return unauthorized();

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const { id } = await params;
  const body = await request.json();
  const parsed = trainingScheduleSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { trainerId, venueId, scheduledDate, startTime, endTime, mentorId, resourceIds } = parsed.data;
  const date = scheduledDate ? new Date(scheduledDate) : undefined;
  const excludeId = parseInt(id);

  // §17: schedule-level mentor must be an active TrainingMentor master record.
  if (mentorId) {
    const mentor = await prisma.trainingMentor.findFirst({
      where: { id: mentorId, companyId, isActive: true, deletedAt: null },
    });
    if (!mentor) {
      return NextResponse.json({ error: 'Invalid mentor (TrainingMentor master record not found)' }, { status: 400 });
    }
  }

  // Time-overlap conflict check (BRD §19, §39): same date + overlapping times.
  const overlaps = (aStart?: string | null, aEnd?: string | null, bStart?: string | null, bEnd?: string | null) => {
    if (!aStart || !aEnd || !bStart || !bEnd) return true;
    return aStart < bEnd && aEnd > bStart;
  };

  if (trainerId && date) {
    const sameDay = await prisma.trainingSchedule.findMany({
      where: { companyId, deletedAt: null, trainerId, scheduledDate: date, status: { not: 'CANCELLED' }, id: { not: excludeId } },
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
      where: { companyId, deletedAt: null, venueId, scheduledDate: date, status: { not: 'CANCELLED' }, id: { not: excludeId } },
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

  // §19: resource booking conflict check — validate against other non-cancelled
  // same-day sessions (excluding this one) when resourceIds are being set.
  const requestedResources: number[] = (() => {
    if (!resourceIds) return [];
    try {
      const arr = JSON.parse(resourceIds);
      return Array.isArray(arr) ? arr.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
    } catch { return []; }
  })();
  if (resourceIds !== undefined && requestedResources.length > 0) {
    const effectiveDate = date ?? (await prisma.trainingSchedule.findUnique({ where: { id: excludeId }, select: { scheduledDate: true } }))?.scheduledDate;
    if (!effectiveDate) {
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
      where: { companyId, deletedAt: null, scheduledDate: effectiveDate, status: { not: 'CANCELLED' }, id: { not: excludeId }, resourceIds: { not: null } },
      select: { id: true, startTime: true, endTime: true, resourceIds: true },
    });
    const overlapping = sameDay.filter((s) => overlaps(startTime, endTime, s.startTime, s.endTime));
    for (const res of resources) {
      const used = overlapping.filter((s) => {
        try { return (JSON.parse(s.resourceIds ?? '[]') as number[]).includes(res.id); } catch { return false; }
      }).length;
      if (used >= res.quantity) {
        return NextResponse.json({ error: `Resource "${res.name}" is fully booked on this date/time` }, { status: 409 });
      }
    }
  }

  const record = await prisma.trainingSchedule.update({
    where: { id: parseInt(id) },
    data: {
      ...parsed.data,
      status: parsed.data.status?.toUpperCase(),
      scheduledDate: date ?? undefined,
      // startTime/endTime: omitted from a partial update must NOT null the
      // stored values — the spread already handles explicit null clears.
    },
  });

  return NextResponse.json(record);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!request.headers.get('x-role-id')) return unauthorized();

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const { id } = await params;
  const record = await prisma.trainingSchedule.findFirst({
    where: { id: parseInt(id), companyId, deletedAt: null },
  });
  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // §51: completed training records cannot be deleted by normal users.
  if (record.status === 'COMPLETED' && !(await isLearningAdmin(request))) {
    return NextResponse.json({ error: 'Completed training records cannot be deleted' }, { status: 400 });
  }

  await prisma.trainingSchedule.update({
    where: { id: parseInt(id) },
    data: { deletedAt: new Date(), isActive: false },
  });

  return NextResponse.json({ message: 'Soft-deleted' }, { status: 200 });
}
