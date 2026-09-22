import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { trainingProviderUpdateSchema } from '@/lib/validations/learning';
import { auditLearning } from '@/lib/learning/shared';

function actorOf(request: NextRequest) {
  return {
    userId: Number(request.headers.get('x-user-id')) || null,
    employeeId: null,
    source: 'user' as const,
    ipAddress: request.headers.get('x-forwarded-for') ?? null,
  };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!request.headers.get('x-role-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.trainingProvider.findFirst({ where: { id: numericId, companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const parsed = trainingProviderUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.trainingProvider.update({ where: { id: numericId }, data: parsed.data });
  await auditLearning(companyId, actorOf(request), 'TrainingProvider', numericId, 'UPDATE', existing, record);
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!request.headers.get('x-role-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.trainingProvider.findFirst({ where: { id: numericId, companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.trainingProvider.update({ where: { id: numericId }, data: { deletedAt: new Date(), isActive: false } });
  await auditLearning(companyId, actorOf(request), 'TrainingProvider', numericId, 'DELETE', existing, null, 'Soft-deleted');
  return NextResponse.json({ message: 'Soft-deleted' });
}
