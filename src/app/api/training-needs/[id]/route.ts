import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { trainingNeedSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning, notifyLearning, learningApprovalStep } from '@/lib/learning/shared';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;
  const { id } = await params;

  const record = await prisma.trainingNeedRequest.findFirst({
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

  const existing = await prisma.trainingNeedRequest.findFirst({
    where: { id: numericId, companyId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const parsed = trainingNeedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.trainingNeedRequest.update({
    where: { id: numericId },
    data: parsed.data,
  });

  await auditLearning(companyId, actor, 'TrainingNeedRequest', numericId, 'UPDATE', existing, record);
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.trainingNeedRequest.findFirst({
    where: { id: numericId, companyId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.trainingNeedRequest.update({
    where: { id: numericId },
    data: { deletedAt: new Date(), isActive: false },
  });

  await auditLearning(companyId, actor, 'TrainingNeedRequest', numericId, 'DELETE', existing, null, 'Soft-deleted');
  return NextResponse.json({ message: 'Soft-deleted' });
}

// Approve / reject a TNA request (BRD §21).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.trainingNeedRequest.findFirst({
    where: { id: numericId, companyId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const action = String(body.action ?? '').toUpperCase();
  const rejectionReason = typeof body.rejectionReason === 'string' ? body.rejectionReason : null;

  if (!['APPROVE', 'REJECT', 'RETURN', 'RESUBMIT'].includes(action)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  if (action === 'RESUBMIT' && existing.status !== 'RETURNED') {
    return NextResponse.json({ error: 'Only a returned request can be resubmitted' }, { status: 409 });
  }
  if (action !== 'RESUBMIT' && !['DRAFT', 'PENDING', 'SUBMITTED'].includes(existing.status)) {
    return NextResponse.json({ error: `Request is already ${existing.status}` }, { status: 409 });
  }

  // Multi-level approval via ApprovalChainConfig (module TRAINING). Falls
  // back to single-step approve/reject when no chain is configured.
  const result = await learningApprovalStep(request, companyId, actor, {
    module: 'TRAINING',
    subjectEmployeeId: existing.employeeId,
    currentStageOrder: existing.currentStageOrder,
    action: action as 'APPROVE' | 'REJECT' | 'RETURN' | 'RESUBMIT',
  });
  if ('error' in result) return result.error;

  let record;
  if (result.outcome === 'ADVANCED') {
    record = await prisma.trainingNeedRequest.update({
      where: { id: numericId },
      data: { status: 'PENDING', currentStageOrder: result.nextStageOrder },
    });
  } else if (result.outcome === 'RESUBMITTED') {
    record = await prisma.trainingNeedRequest.update({
      where: { id: numericId },
      data: {
        status: 'PENDING',
        currentStageOrder: result.firstStageOrder ?? 0,
        rejectedByUserId: null, rejectedAt: null, rejectionReason: null,
      },
    });
  } else {
    const status = result.outcome; // APPROVED | REJECTED | RETURNED
    record = await prisma.trainingNeedRequest.update({
      where: { id: numericId },
      data: {
        status,
        ...(status === 'APPROVED'
          ? { approvedByUserId: actor.userId, approvedAt: new Date() }
          : { rejectedByUserId: actor.userId, rejectedAt: new Date(), rejectionReason }),
      },
    });
  }

  await auditLearning(companyId, actor, 'TrainingNeedRequest', numericId, `${action}_${result.outcome}`, existing, record);
  const event =
    result.outcome === 'APPROVED' ? 'TNA_APPROVED'
    : result.outcome === 'REJECTED' ? 'TNA_REJECTED'
    : result.outcome === 'RETURNED' ? 'TNA_RETURNED'
    : 'TNA_SUBMITTED';
  notifyLearning(companyId, event, {
    moduleCode: 'TRDV',
    sourceEntityType: 'TrainingNeedRequest',
    sourceEntityId: numericId,
    subjectEmpId: record.employeeId,
    linkPath: `/learning/training-needs`,
  });

  return NextResponse.json(record);
}
