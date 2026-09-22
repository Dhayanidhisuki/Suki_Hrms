import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';

/**
 * GET /api/training-schedules/availability?date=YYYY-MM-DD[&start=HH:mm&end=HH:mm]
 * §19: venue + resource availability browser — returns every active venue and
 * bookable resource with the sessions occupying it on the given date so the UI
 * can show what's free and what's booked.
 */
export async function GET(request: NextRequest) {
  if (!request.headers.get('x-role-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  const overlaps = (aStart?: string | null, aEnd?: string | null, bStart?: string | null, bEnd?: string | null) => {
    if (!aStart || !aEnd || !bStart || !bEnd) return true;
    return aStart < bEnd && aEnd > bStart;
  };

  const [venues, resources, sessions] = await Promise.all([
    prisma.trainingVenue.findMany({ where: { companyId, isActive: true, deletedAt: null } }),
    prisma.trainingResource.findMany({ where: { companyId, isActive: true, deletedAt: null } }),
    prisma.trainingSchedule.findMany({
      where: { companyId, deletedAt: null, scheduledDate: date, status: { not: 'CANCELLED' } },
      select: { id: true, title: true, venueId: true, startTime: true, endTime: true, resourceIds: true, trainingProgram: { select: { name: true } } },
    }),
  ]);

  const inWindow = (s: { startTime: string | null; endTime: string | null }) =>
    !start || !end ? true : overlaps(start, end, s.startTime, s.endTime);

  const venueAvailability = venues.map((v) => {
    const bookings = sessions.filter((s) => s.venueId === v.id && inWindow(s));
    return {
      id: v.id,
      name: v.name,
      capacity: v.capacity,
      available: bookings.length === 0,
      bookings: bookings.map((b) => ({ id: b.id, title: b.title ?? b.trainingProgram.name, startTime: b.startTime, endTime: b.endTime })),
    };
  });

  const resourceAvailability = resources.map((r) => {
    const used = sessions.filter((s) => {
      if (!inWindow(s)) return false;
      try { return (JSON.parse(s.resourceIds ?? '[]') as number[]).includes(r.id); } catch { return false; }
    });
    return {
      id: r.id,
      name: r.name,
      resourceType: r.resourceType,
      quantity: r.quantity,
      status: r.status,
      used: used.length,
      remaining: Math.max(0, r.quantity - used.length),
      available: r.status === 'AVAILABLE' && used.length < r.quantity,
      bookings: used.map((b) => ({ id: b.id, title: b.title ?? b.trainingProgram.name, startTime: b.startTime, endTime: b.endTime })),
    };
  });

  return NextResponse.json({ date: dateStr, venues: venueAvailability, resources: resourceAvailability });
}
