import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { externalTrainingUpdateSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning, isLearningAdmin, learningApprovalStep, notifyLearning } from '@/lib/learning/shared';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;
  const { id } = await params;

  const record = await prisma.externalTraining.findFirst({
    where: { id: parseInt(id), companyId, deletedAt: null },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const participants = await prisma.externalTrainingParticipant.findMany({
    where: { companyId, externalTrainingId: record.id, deletedAt: null },
    orderBy: { id: 'asc' },
  });
  return NextResponse.json({ ...record, participants });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.externalTraining.findFirst({
    where: { id: numericId, companyId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const parsed = externalTrainingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // providerName is a required column — a null in the payload means "leave it",
  // not "blank it" (blank would violate the not-null constraint anyway).
  const { providerName, ...rest } = parsed.data;
  const record = await prisma.externalTraining.update({
    where: { id: numericId },
    data: { ...rest, providerName: providerName ?? undefined },
  });
  await auditLearning(companyId, actor, 'ExternalTraining', numericId, 'UPDATE', existing, record);
  return NextResponse.json(record);
}

/**
 * PATCH { action, reason? } — §21 approval workflow for external training.
 * Actions: SUBMIT | APPROVE | REJECT | RETURN | RESUBMIT | CANCEL |
 *          START | COMPLETE. Uses the ApprovalChainConfig chain for module
 *          'TRAINING_EXTERNAL' (e.g. Manager → Dept Head → HR → Finance →
 *          Management); with no chain configured, single-step approve.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.externalTraining.findFirst({
    where: { id: numericId, companyId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? '').toUpperCase();
  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 500) : null;

  // Simple lifecycle actions (no chain needed).
  const simple: Record<string, { from: string[]; to: string }> = {
    SUBMIT: { from: ['PLANNED', 'RETURNED'], to: 'SUBMITTED' },
    START: { from: ['APPROVED'], to: 'IN_PROGRESS' },
    COMPLETE: { from: ['IN_PROGRESS', 'APPROVED'], to: 'COMPLETED' },
  };
  if (simple[action]) {
    if (!simple[action].from.includes(existing.status)) {
      return NextResponse.json({ error: `Cannot ${action} a record in ${existing.status} status` }, { status: 409 });
    }
    const record = await prisma.externalTraining.update({
      where: { id: numericId },
      data: { status: simple[action].to, ...(action === 'SUBMIT' ? { currentStageOrder: 0, rejectionReason: null } : {}) },
    });
    // §35: completing the external training marks active participants completed.
    if (action === 'COMPLETE') {
      await prisma.externalTrainingParticipant.updateMany({
        where: { companyId, externalTrainingId: numericId, status: 'NOMINATED', deletedAt: null },
        data: { status: 'COMPLETED' },
      });
    }
    await auditLearning(companyId, actor, 'ExternalTraining', numericId, action, existing, record, reason);
    return NextResponse.json(record);
  }

  if (!['APPROVE', 'REJECT', 'RETURN', 'RESUBMIT', 'CANCEL'].includes(action)) {
    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
  }

  // CANCEL is allowed by the creator's side (admin/HR) — creator-side guard.
  if (action === 'CANCEL' && !(await isLearningAdmin(request))) {
    return NextResponse.json({ error: 'Only HR/Admin may cancel an external training' }, { status: 403 });
  }

  const firstEmployeeId = (() => {
    try { return JSON.parse(existing.employeeIds ?? '[]')[0] ?? null; } catch { return null; }
  })();

  const result = await learningApprovalStep(request, companyId, actor, {
    module: 'TRAINING_EXTERNAL',
    subjectEmployeeId: typeof firstEmployeeId === 'number' ? firstEmployeeId : null,
    currentStageOrder: existing.currentStageOrder,
    action: action as 'APPROVE' | 'REJECT' | 'RETURN' | 'RESUBMIT' | 'CANCEL',
  });
  if ('error' in result) return result.error;

  const data: Record<string, unknown> = {};
  switch (result.outcome) {
    case 'APPROVED': data.status = 'APPROVED'; break;
    case 'ADVANCED': data.status = 'UNDER_REVIEW'; data.currentStageOrder = result.nextStageOrder; break;
    case 'REJECTED': data.status = 'REJECTED'; data.rejectionReason = reason; break;
    case 'RETURNED': data.status = 'RETURNED'; data.rejectionReason = reason; break;
    case 'RESUBMITTED': data.status = 'SUBMITTED'; data.currentStageOrder = result.firstStageOrder ?? 0; break;
    case 'CANCELLED': data.status = 'CANCELLED'; break;
  }

  const record = await prisma.externalTraining.update({ where: { id: numericId }, data });
  await auditLearning(companyId, actor, 'ExternalTraining', numericId, action, existing, record, reason);
  notifyLearning(companyId, 'EXTERNAL_STATUS_CHANGED', {
    moduleCode: 'TRDV',
    sourceEntityType: 'ExternalTraining',
    sourceEntityId: numericId,
    linkPath: '/learning/operations',
    data: { Training: { Title: record.title, Status: record.status } },
  });
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.externalTraining.findFirst({
    where: { id: numericId, companyId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // §51: paid/completed external trainings are protected financial records.
  if ((existing.status === 'COMPLETED' || existing.paymentStatus === 'PAID') && !(await isLearningAdmin(request))) {
    return NextResponse.json({ error: 'Completed/paid external trainings cannot be deleted' }, { status: 400 });
  }

  await prisma.externalTraining.update({ where: { id: numericId }, data: { deletedAt: new Date(), isActive: false } });
  await auditLearning(companyId, actor, 'ExternalTraining', numericId, 'DELETE', existing, null, 'Soft-deleted');
  return NextResponse.json({ message: 'Deleted' });
}
