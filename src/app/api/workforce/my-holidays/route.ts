/**
 * GET /api/workforce/my-holidays?year=YYYY
 *   The company's declared holidays and yearly leave calendar entries for
 *   a year. Read-only, open to any authenticated employee — a holiday
 *   calendar is company-wide, non-sensitive information every employee
 *   needs, unlike /api/masters/holidays (masters.definition.view-gated,
 *   the full HR CRUD screen with edit/delete).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year')) || new Date().getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const [holidays, yearlyLeave] = await Promise.all([
    prisma.holidayMaster.findMany({
      where: { companyId: scope.companyId, isActive: true, deletedAt: null, date: { gte: yearStart, lt: yearEnd } },
      select: { id: true, date: true, name: true, holidayType: true, description: true },
      orderBy: { date: 'asc' },
    }),
    prisma.yearlyLeaveCalendar.findMany({
      where: { companyId: scope.companyId, isActive: true, deletedAt: null, date: { gte: yearStart, lt: yearEnd } },
      select: { id: true, date: true, name: true, description: true },
      orderBy: { date: 'asc' },
    }),
  ]);

  return NextResponse.json({ year, holidays, yearlyLeave });
}
