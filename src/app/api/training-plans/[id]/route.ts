import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { trainingPlanSchema } from '@/lib/validations/learning';
import { auditLearning, isLearningAdmin, learningApprovalStep, notifyLearning } from '@/lib/learning/shared';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function actorOf(request: NextRequest) {
  return {
    userId: Number(request.headers.get('x-user-id')) || null,
    employeeId: Number(request.headers.get('x-employee-id')) || null,
    source: 'user' as const,
    ipAddress: request.headers.get('x-forwarded-for') ?? null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!request.headers.get('x-role-id')) return unauthorized();

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const { id } = await params;
  const record = await prisma.trainingPlan.findFirst({
    where: { id: parseInt(id), companyId, deletedAt: null },
    include: {
      lines: { where: { deletedAt: null }, orderBy: { plannedMonth: 'asc' } },
    },
  });
  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(record);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!request.headers.get('x-role-id')) return unauthorized();

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;

  const { id } = await params;
  const body = await request.json();
  const parsed = trainingPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const record = await prisma.trainingPlan.update({
    where: { id: parseInt(id) },
    data: { ...parsed.data, status: parsed.data.status.toUpperCase() },
  });

  return NextResponse.json(record);
}

/**
 * PATCH { action, reason? } — §14 annual plan approval workflow.
 * Actions: SUBMIT | APPROVE | REJECT | RETURN | RESUBMIT | CANCEL.
 * Uses the shared chain engine (module 'TRAINING_PLAN'); with no chain
 * configured it falls back to single-step approve/reject.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!request.headers.get('x-role-id')) return unauthorized();
  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;
  const actor = actorOf(request);

  const { id } = await params;
  const numericId = parseInt(id);
  const existing = await prisma.trainingPlan.findFirst({
    where: { id: numericId, companyId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? '').toUpperCase();
  const reason = typeof body?.reason === 'string' ? body.reason : null;

  if (action === 'SUBMIT') {
    if (!['DRAFT', 'RETURNED'].includes(existing.status)) {
      return NextResponse.json({ error: `Cannot submit a plan in ${existing.status} status` }, { status: 409 });
    }
    const record = await prisma.trainingPlan.update({
      where: { id: numericId },
      data: { status: 'SUBMITTED', currentStageOrder: 0, rejectionReason: null },
    });
    await auditLearning(companyId, actor, 'TrainingPlan', numericId, 'SUBMIT', existing, record, reason);
    return NextResponse.json(record);
  }

  if (!['APPROVE', 'REJECT', 'RETURN', 'RESUBMIT', 'CANCEL'].includes(action)) {
    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
  }
  if (action === 'CANCEL' && !(await isLearningAdmin(request))) {
    return NextResponse.json({ error: 'Only HR/Admin can cancel a training plan' }, { status: 403 });
  }

  const result = await learningApprovalStep(request, companyId, actor, {
    module: 'TRAINING_PLAN',
    currentStageOrder: existing.currentStageOrder,
    action: action as 'APPROVE' | 'REJECT' | 'RETURN' | 'RESUBMIT' | 'CANCEL',
  });
  if ('error' in result) return result.error;

  const data: Record<string, unknown> = {};
  switch (result.outcome) {
    case 'APPROVED':
      data.status = 'APPROVED';
      data.approvedByUserId = actor.userId;
      data.approvedAt = new Date();
      break;
    case 'ADVANCED':
      data.status = 'UNDER_REVIEW';
      data.currentStageOrder = result.nextStageOrder;
      break;
    case 'REJECTED':
      data.status = 'REJECTED';
      data.rejectionReason = reason;
      data.rejectedByUserId = actor.userId;
      data.rejectedAt = new Date();
      break;
    case 'RETURNED':
      data.status = 'RETURNED';
      data.rejectionReason = reason;
      break;
    case 'RESUBMITTED':
      data.status = 'SUBMITTED';
      data.currentStageOrder = result.firstStageOrder ?? 0;
      data.rejectionReason = null;
      break;
    case 'CANCELLED':
      data.status = 'CANCELLED';
      break;
  }

  const record = await prisma.trainingPlan.update({ where: { id: numericId }, data });
  await auditLearning(companyId, actor, 'TrainingPlan', numericId, action, existing, record, reason);
  notifyLearning(companyId, 'PLAN_STATUS_CHANGED', {
    moduleCode: 'TRDV',
    sourceEntityType: 'TrainingPlan',
    sourceEntityId: numericId,
    linkPath: '/learning/training-plan',
  });
  return NextResponse.json(record);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!request.headers.get('x-role-id')) return unauthorized();

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const { id } = await params;
  const record = await prisma.trainingPlan.findFirst({
    where: { id: parseInt(id), companyId, deletedAt: null },
  });
  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.trainingPlan.update({
    where: { id: parseInt(id) },
    data: { deletedAt: new Date(), isActive: false },
  });

  return NextResponse.json({ message: 'Soft-deleted' }, { status: 200 });
}
