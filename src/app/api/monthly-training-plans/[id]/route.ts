/**
 * PUT    /api/monthly-training-plans/[id] — update header + replace lines
 *        (only while DRAFT/POSTPONED).
 * PATCH  /api/monthly-training-plans/[id] { action } — §15 status workflow:
 *        SUBMIT / REVIEW / APPROVE / SCHEDULE / START / COMPLETE / CANCEL /
 *        POSTPONE / RETURN.
 * DELETE /api/monthly-training-plans/[id] — soft delete (not when COMPLETED).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { monthlyPlanSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning } from '@/lib/learning/shared';

const LINE_INCLUDE = {
  lines: {
    where: { deletedAt: null },
    include: { trainingProgram: { select: { id: true, name: true, category: true } } },
    orderBy: { plannedDate: 'asc' as const },
  },
};

// action → { from: allowed current statuses, to: next status }
const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  SUBMIT:   { from: ['DRAFT', 'POSTPONED'], to: 'SUBMITTED' },
  REVIEW:   { from: ['SUBMITTED'], to: 'UNDER_REVIEW' },
  APPROVE:  { from: ['SUBMITTED', 'UNDER_REVIEW'], to: 'APPROVED' },
  SCHEDULE: { from: ['APPROVED'], to: 'SCHEDULED' },
  START:    { from: ['SCHEDULED', 'APPROVED'], to: 'IN_PROGRESS' },
  COMPLETE: { from: ['SCHEDULED', 'IN_PROGRESS'], to: 'COMPLETED' },
  CANCEL:   { from: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'SCHEDULED', 'POSTPONED'], to: 'CANCELLED' },
  POSTPONE: { from: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'SCHEDULED'], to: 'POSTPONED' },
  RETURN:   { from: ['SUBMITTED', 'UNDER_REVIEW'], to: 'DRAFT' },
};

async function findPlan(companyId: number, id: number) {
  return prisma.monthlyTrainingPlan.findFirst({ where: { id, companyId, deletedAt: null } });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const planId = parseInt(id);

  const existing = await findPlan(companyId, planId);
  if (!existing) return NextResponse.json({ error: 'Monthly plan not found' }, { status: 404 });
  if (!['DRAFT', 'POSTPONED'].includes(existing.status)) {
    return NextResponse.json({ error: `Cannot edit a plan in ${existing.status} status` }, { status: 409 });
  }

  const body = await request.json();
  const parsed = monthlyPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { lines, generateFromAnnual: _generateFromAnnual, ...header } = parsed.data;
  void _generateFromAnnual;

  await prisma.$transaction([
    prisma.monthlyTrainingPlanLine.deleteMany({ where: { monthlyPlanId: planId } }),
    prisma.monthlyTrainingPlan.update({
      where: { id: planId },
      data: {
        trainingPlanId: header.trainingPlanId ?? null,
        year: header.year,
        month: header.month,
        departmentId: header.departmentId ?? null,
        remarks: header.remarks ?? null,
      },
    }),
    prisma.monthlyTrainingPlanLine.createMany({
      data: lines.map((l) => ({ ...l, companyId, monthlyPlanId: planId })),
    }),
  ]);

  const record = await prisma.monthlyTrainingPlan.findFirst({ where: { id: planId }, include: LINE_INCLUDE });
  await auditLearning(companyId, actor, 'MonthlyTrainingPlan', planId, 'UPDATE', existing, record);
  return NextResponse.json(record);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const planId = parseInt(id);

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? '').toUpperCase();
  const transition = TRANSITIONS[action];
  if (!transition) {
    return NextResponse.json({ error: `Unknown action "${action}"`, details: { allowed: Object.keys(TRANSITIONS) } }, { status: 400 });
  }

  const existing = await findPlan(companyId, planId);
  if (!existing) return NextResponse.json({ error: 'Monthly plan not found' }, { status: 404 });
  if (!transition.from.includes(existing.status)) {
    return NextResponse.json(
      { error: `Cannot ${action} a plan in ${existing.status} status`, allowedFrom: transition.from },
      { status: 409 }
    );
  }

  const data: Record<string, unknown> = { status: transition.to };
  if (action === 'APPROVE') {
    data.approvedByUserId = actor.userId;
    data.approvedAt = new Date();
  }

  const record = await prisma.monthlyTrainingPlan.update({ where: { id: planId }, data, include: LINE_INCLUDE });
  await auditLearning(companyId, actor, 'MonthlyTrainingPlan', planId, action, existing, record);
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const planId = parseInt(id);

  const existing = await findPlan(companyId, planId);
  if (!existing) return NextResponse.json({ error: 'Monthly plan not found' }, { status: 404 });
  if (existing.status === 'COMPLETED') {
    return NextResponse.json({ error: 'Completed plans cannot be deleted' }, { status: 409 });
  }

  await prisma.monthlyTrainingPlan.update({ where: { id: planId }, data: { deletedAt: new Date(), isActive: false } });
  await auditLearning(companyId, actor, 'MonthlyTrainingPlan', planId, 'DELETE', existing, null);
  return NextResponse.json({ success: true });
}
