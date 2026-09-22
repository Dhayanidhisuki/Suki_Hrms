import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth, auditLearning } from '@/lib/learning/shared';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.inductionAssignment.findFirst({ where: { id: numericId, companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const action = String(body.action ?? '').toUpperCase();

  if (action === 'COMPLETE') {
    const record = await prisma.inductionAssignment.update({
      where: { id: numericId },
      data: { status: 'COMPLETED', completedDate: new Date() },
    });
    await auditLearning(companyId, actor, 'InductionAssignment', numericId, 'COMPLETE', existing, record);
    return NextResponse.json(record);
  }

  if (action === 'CANCEL') {
    const record = await prisma.inductionAssignment.update({
      where: { id: numericId },
      data: { status: 'CANCELLED' },
    });
    await auditLearning(companyId, actor, 'InductionAssignment', numericId, 'CANCEL', existing, record);
    return NextResponse.json(record);
  }

  return NextResponse.json({ error: 'Unknown action. Use COMPLETE or CANCEL.' }, { status: 400 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.inductionAssignment.findFirst({ where: { id: numericId, companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.inductionAssignment.update({ where: { id: numericId }, data: { deletedAt: new Date() } });
  await auditLearning(companyId, actor, 'InductionAssignment', numericId, 'DELETE', existing, null, 'Soft-deleted');
  return NextResponse.json({ message: 'Soft-deleted' });
}
