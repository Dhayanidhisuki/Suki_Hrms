import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { trainingEffectivenessSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning } from '@/lib/learning/shared';

function computeRating(preScore: number | null, postScore: number | null): string | null {
  if (preScore == null || postScore == null) return null;
  const improvement = postScore - preScore;
  if (improvement >= 75) return 'EXCELLENT';
  if (improvement >= 50) return 'GOOD';
  if (improvement >= 25) return 'AVERAGE';
  return 'POOR';
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.trainingEffectiveness.findFirst({ where: { id: numericId, companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const parsed = trainingEffectivenessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const preScore = parsed.data.preScore ?? existing.preScore;
  const postScore = parsed.data.postScore ?? existing.postScore;
  const scoreImprovement = preScore != null && postScore != null ? postScore - preScore : null;
  const effectivenessRating = parsed.data.effectivenessRating ?? computeRating(preScore, postScore);

  const record = await prisma.trainingEffectiveness.update({
    where: { id: numericId },
    data: { ...parsed.data, scoreImprovement, effectivenessRating },
  });
  await auditLearning(companyId, actor, 'TrainingEffectiveness', numericId, 'UPDATE', existing, record);
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.trainingEffectiveness.findFirst({ where: { id: numericId, companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.trainingEffectiveness.update({ where: { id: numericId }, data: { deletedAt: new Date() } });
  await auditLearning(companyId, actor, 'TrainingEffectiveness', numericId, 'DELETE', existing, null, 'Soft-deleted');
  return NextResponse.json({ message: 'Soft-deleted' });
}
