import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const employeeId = await resolveOwnEmployeeId(userId);
  if (!employeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const year = Number(request.nextUrl.searchParams.get('year') ?? new Date().getFullYear());
  const month = Number(request.nextUrl.searchParams.get('month') ?? new Date().getMonth() + 1);

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const data = await prisma.petrolAllowanceEntry.findMany({
    where: {
      employeeId,
      travelDate: { gte: monthStart, lt: monthEnd },
    },
    orderBy: { travelDate: 'desc' },
  });

  return NextResponse.json({ data });
}
