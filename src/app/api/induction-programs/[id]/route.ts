import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { inductionProgramSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning } from '@/lib/learning/shared';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.inductionProgram.findFirst({ where: { id: numericId, companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const parsed = inductionProgramSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.inductionProgram.update({ where: { id: numericId }, data: parsed.data });
  await auditLearning(companyId, actor, 'InductionProgram', numericId, 'UPDATE', existing, record);
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.inductionProgram.findFirst({ where: { id: numericId, companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.inductionProgram.update({ where: { id: numericId }, data: { deletedAt: new Date(), isActive: false } });
  await auditLearning(companyId, actor, 'InductionProgram', numericId, 'DELETE', existing, null, 'Soft-deleted');
  return NextResponse.json({ message: 'Soft-deleted' });
}
