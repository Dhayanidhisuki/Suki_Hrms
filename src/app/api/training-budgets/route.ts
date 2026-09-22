import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { trainingBudgetSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') ?? '';

  const data = await prisma.trainingBudget.findMany({
    where: { companyId, deletedAt: null, ...(year ? { year } : {}) },
    orderBy: { year: 'desc' },
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = trainingBudgetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Unique per (company, year, department).
  const dup = await prisma.trainingBudget.findFirst({
    where: { companyId, year: parsed.data.year, departmentId: parsed.data.departmentId ?? null, deletedAt: null },
  });
  if (dup) return NextResponse.json({ error: 'Budget already exists for this year/department' }, { status: 409 });

  const record = await prisma.trainingBudget.create({
    data: { ...parsed.data, companyId },
  });
  await auditLearning(companyId, actor, 'TrainingBudget', record.id, 'CREATE', null, record);
  return NextResponse.json(record, { status: 201 });
}
