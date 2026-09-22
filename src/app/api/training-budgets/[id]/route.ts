import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { trainingBudgetSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning } from '@/lib/learning/shared';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.trainingBudget.findFirst({ where: { id: numericId, companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const parsed = trainingBudgetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const dup = await prisma.trainingBudget.findFirst({
    where: {
      companyId,
      year: parsed.data.year,
      departmentId: parsed.data.departmentId ?? null,
      deletedAt: null,
      id: { not: numericId },
    },
  });
  if (dup) return NextResponse.json({ error: 'Budget already exists for this year/department' }, { status: 409 });

  const record = await prisma.trainingBudget.update({ where: { id: numericId }, data: parsed.data });
  await auditLearning(companyId, actor, 'TrainingBudget', numericId, 'UPDATE', existing, record);
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.trainingBudget.findFirst({ where: { id: numericId, companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.trainingBudget.update({ where: { id: numericId }, data: { deletedAt: new Date(), isActive: false } });
  await auditLearning(companyId, actor, 'TrainingBudget', numericId, 'DELETE', existing, null, 'Soft-deleted');
  return NextResponse.json({ message: 'Soft-deleted' });
}
