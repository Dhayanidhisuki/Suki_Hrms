import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth } from '@/lib/learning/shared';

// Training history for one employee (used by the employee profile tab, BRD §36).
export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId') ?? '';
  const year = searchParams.get('year') ?? '';
  const status = searchParams.get('status') ?? '';
  const programId = searchParams.get('programId') ?? '';

  const dateRange = year
    ? { gte: new Date(`${parseInt(year)}-01-01`), lt: new Date(`${parseInt(year) + 1}-01-01`) }
    : undefined;

  const data = await prisma.trainingHistory.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(employeeId ? { employeeId: parseInt(employeeId) } : {}),
      ...(status ? { status } : {}),
      ...(programId ? { trainingProgramId: parseInt(programId) } : {}),
      ...(dateRange ? { scheduledDate: dateRange } : {}),
    },
    orderBy: { scheduledDate: 'desc' },
  });

  return NextResponse.json({ data });
}
