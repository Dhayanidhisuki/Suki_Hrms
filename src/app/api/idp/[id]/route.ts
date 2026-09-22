import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { idpUpdateSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning } from '@/lib/learning/shared';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;
  const { id } = await params;
  const record = await prisma.individualDevelopmentPlan.findFirst({
    where: { id: parseInt(id), companyId, deletedAt: null },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.individualDevelopmentPlan.findFirst({
    where: { id: numericId, companyId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const parsed = idpUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.individualDevelopmentPlan.update({ where: { id: numericId }, data: parsed.data });
  await auditLearning(companyId, actor, 'IndividualDevelopmentPlan', numericId, 'UPDATE', existing, record);
  return NextResponse.json(record);
}

// PATCH /api/idp/[id] — { action: 'APPROVE' } marks the plan approved.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.individualDevelopmentPlan.findFirst({
    where: { id: numericId, companyId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  if (String(body.action ?? '').toUpperCase() !== 'APPROVE') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  const record = await prisma.individualDevelopmentPlan.update({
    where: { id: numericId },
    data: { approvedByUserId: actor.userId, approvedAt: new Date() },
  });
  await auditLearning(companyId, actor, 'IndividualDevelopmentPlan', numericId, 'APPROVE', existing, record);
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.individualDevelopmentPlan.findFirst({
    where: { id: numericId, companyId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.individualDevelopmentPlan.update({ where: { id: numericId }, data: { deletedAt: new Date(), isActive: false } });
  await auditLearning(companyId, actor, 'IndividualDevelopmentPlan', numericId, 'DELETE', existing, null, 'Soft-deleted');
  return NextResponse.json({ message: 'Deleted' });
}
