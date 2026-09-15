/**
 * GET  /api/masters/yearly-leave-calendar
 *   — list yearly leave calendar entries for this company.
 *   ?year=YYYY (optional, defaults to current year)
 * POST /api/masters/yearly-leave-calendar
 *   — create/update a yearly leave calendar entry.
 *   Body: { date, leaveTypeMasterId, name, description? }
 * DELETE /api/masters/yearly-leave-calendar
 *   — soft-delete an entry. Body: { id }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD expected');

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.definition.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const yearStr = request.nextUrl.searchParams.get('year');
  const year = yearStr ? Number(yearStr) : new Date().getUTCFullYear();

  const data = await prisma.yearlyLeaveCalendar.findMany({
    where: {
      companyId: scope.companyId,
      deletedAt: null,
      date: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
    include: {
      leaveTypeMaster: { select: { id: true, code: true, name: true, color: true } },
    },
    orderBy: { date: 'asc' },
  });

  return NextResponse.json({ data });
}

const createSchema = z.object({
  date: isoDate,
  leaveTypeMasterId: z.number().int().positive(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.definition.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const date = new Date(parsed.data.date);

  // Upsert: if [companyId, date] exists, update; otherwise create.
  const existing = await prisma.yearlyLeaveCalendar.findUnique({
    where: { companyId_date: { companyId: scope.companyId, date } },
  });

  if (existing) {
    const updated = await prisma.yearlyLeaveCalendar.update({
      where: { id: existing.id },
      data: {
        leaveTypeMasterId: parsed.data.leaveTypeMasterId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        deletedAt: null,
        isActive: true,
      },
      include: { leaveTypeMaster: { select: { id: true, code: true, name: true, color: true } } },
    });
    return NextResponse.json(updated);
  }

  const created = await prisma.yearlyLeaveCalendar.create({
    data: {
      companyId: scope.companyId,
      date,
      leaveTypeMasterId: parsed.data.leaveTypeMasterId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    },
    include: { leaveTypeMaster: { select: { id: true, code: true, name: true, color: true } } },
  });
  return NextResponse.json(created);
}

export async function DELETE(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.definition.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { count } = await prisma.yearlyLeaveCalendar.updateMany({
    where: { id, companyId: scope.companyId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  });
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ deleted: id });
}
