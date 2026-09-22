/**
 * PUT    /api/training-cost-items/[id] — edit a cost item (re-syncs budget).
 * DELETE /api/training-cost-items/[id] — soft delete (reverses budget).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { trainingCostItemSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning, adjustBudgetUtilization } from '@/lib/learning/shared';

async function scopeOf(companyId: number, scheduleId: number | null, externalId: number | null) {
  if (scheduleId) {
    const s = await prisma.trainingSchedule.findFirst({ where: { id: scheduleId, companyId }, select: { scheduledDate: true, targetDepartmentId: true } });
    return s ? { year: String(s.scheduledDate?.getFullYear() ?? new Date().getFullYear()), departmentId: s.targetDepartmentId } : null;
  }
  if (externalId) {
    const e = await prisma.externalTraining.findFirst({ where: { id: externalId, companyId }, select: { startDate: true } });
    return e ? { year: String(e.startDate?.getFullYear() ?? new Date().getFullYear()), departmentId: null } : null;
  }
  return null;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;

  const existing = await prisma.trainingCostItem.findFirst({ where: { id: parseInt(id), companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Cost item not found' }, { status: 404 });

  const body = await request.json();
  const parsed = trainingCostItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.trainingCostItem.update({
    where: { id: existing.id },
    data: {
      head: parsed.data.head,
      amount: parsed.data.amount,
      description: parsed.data.description ?? null,
    },
  });

  // Re-sync utilization by the amount delta (same budget scope).
  const scope = await scopeOf(companyId, existing.trainingScheduleId, existing.externalTrainingId);
  if (scope) {
    const delta = Number(parsed.data.amount) - Number(existing.amount);
    if (delta !== 0) await adjustBudgetUtilization(companyId, scope.year, scope.departmentId, delta);
  }

  await auditLearning(companyId, actor, 'TrainingCostItem', record.id, 'UPDATE', existing, record);
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;

  const existing = await prisma.trainingCostItem.findFirst({ where: { id: parseInt(id), companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Cost item not found' }, { status: 404 });

  await prisma.trainingCostItem.update({ where: { id: existing.id }, data: { deletedAt: new Date(), isActive: false } });

  const scope = await scopeOf(companyId, existing.trainingScheduleId, existing.externalTrainingId);
  if (scope) await adjustBudgetUtilization(companyId, scope.year, scope.departmentId, -Number(existing.amount));

  await auditLearning(companyId, actor, 'TrainingCostItem', existing.id, 'DELETE', existing, null);
  return NextResponse.json({ success: true });
}
