import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { trainingVenueSchema } from '@/lib/validations/learning';
import { auditLearning } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  if (!request.headers.get('x-role-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const { searchParams } = new URL(request.url);
  const full = searchParams.get('full') === '1';

  const venues = await prisma.trainingVenue.findMany({
    where: { companyId, deletedAt: null, isActive: true },
    orderBy: { name: 'asc' },
    select: full ? undefined : { id: true, name: true },
  });

  return NextResponse.json(venues);
}

export async function POST(request: NextRequest) {
  if (!request.headers.get('x-role-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const body = await request.json();
  const parsed = trainingVenueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.trainingVenue.create({
    data: { ...parsed.data, companyId },
  });

  await auditLearning(companyId, {
    userId: Number(request.headers.get('x-user-id')) || null,
    employeeId: null,
    source: 'user',
    ipAddress: request.headers.get('x-forwarded-for') ?? null,
  }, 'TrainingVenue', record.id, 'CREATE', null, record);
  return NextResponse.json(record, { status: 201 });
}
