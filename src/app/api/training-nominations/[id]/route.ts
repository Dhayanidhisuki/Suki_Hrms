import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth, auditLearning, notifyLearning, isLearningAdmin, learningApprovalStep } from '@/lib/learning/shared';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;
  const { id } = await params;

  const record = await prisma.trainingNomination.findFirst({
    where: { id: parseInt(id), companyId, deletedAt: null },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.trainingNomination.findFirst({
    where: { id: numericId, companyId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // §51: mandatory nominations cannot be deleted once assigned (admins exempt).
  if (existing.reason === 'MANDATORY' && !(await isLearningAdmin(request))) {
    return NextResponse.json({ error: 'Mandatory training nominations cannot be deleted' }, { status: 400 });
  }
  // §51: nominations on completed schedules are protected records.
  const sched = await prisma.trainingSchedule.findFirst({
    where: { id: existing.trainingScheduleId, companyId },
    select: { status: true },
  });
  if (sched?.status === 'COMPLETED' && !(await isLearningAdmin(request))) {
    return NextResponse.json({ error: 'Cannot delete a nomination on a completed training' }, { status: 400 });
  }

  await prisma.trainingNomination.update({
    where: { id: numericId },
    data: { deletedAt: new Date(), isActive: false },
  });

  await auditLearning(companyId, actor, 'TrainingNomination', numericId, 'DELETE', existing, null, 'Nomination cancelled');
  return NextResponse.json({ message: 'Cancelled' });
}

// Approve / reject a nomination (BRD §21).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const numericId = parseInt(id);

  const existing = await prisma.trainingNomination.findFirst({
    where: { id: numericId, companyId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const action = String(body.action ?? '').toUpperCase();
  const rejectionReason = typeof body.rejectionReason === 'string' ? body.rejectionReason : null;

  // CANCEL is a lifecycle action, not an approval step.
  if (action === 'CANCEL') {
    const record = await prisma.trainingNomination.update({
      where: { id: numericId },
      data: { status: 'CANCELLED' },
    });
    await auditLearning(companyId, actor, 'TrainingNomination', numericId, 'CANCELLED', existing, record);
    return NextResponse.json(record);
  }

  if (!['APPROVE', 'REJECT', 'RETURN', 'RESUBMIT'].includes(action)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  if (action === 'RESUBMIT' && existing.status !== 'RETURNED') {
    return NextResponse.json({ error: 'Only a returned nomination can be resubmitted' }, { status: 409 });
  }
  if (action !== 'RESUBMIT' && !['PENDING', 'NOMINATED'].includes(existing.status)) {
    return NextResponse.json({ error: `Nomination is already ${existing.status}` }, { status: 409 });
  }

  // Multi-level approval via ApprovalChainConfig (module TRAINING_NOMINATION).
  // Falls back to single-step when no chain is configured.
  const result = await learningApprovalStep(request, companyId, actor, {
    module: 'TRAINING_NOMINATION',
    subjectEmployeeId: existing.employeeId,
    currentStageOrder: existing.currentStageOrder,
    action: action as 'APPROVE' | 'REJECT' | 'RETURN' | 'RESUBMIT',
  });
  if ('error' in result) return result.error;

  let record;
  if (result.outcome === 'ADVANCED') {
    record = await prisma.trainingNomination.update({
      where: { id: numericId },
      data: { status: 'PENDING', currentStageOrder: result.nextStageOrder },
    });
  } else if (result.outcome === 'RESUBMITTED') {
    record = await prisma.trainingNomination.update({
      where: { id: numericId },
      data: {
        status: 'PENDING',
        currentStageOrder: result.firstStageOrder ?? 0,
        rejectedByUserId: null, rejectedAt: null, rejectionReason: null,
      },
    });
  } else {
    const status = result.outcome; // APPROVED | REJECTED | RETURNED
    record = await prisma.trainingNomination.update({
      where: { id: numericId },
      data: {
        status,
        ...(status === 'APPROVED'
          ? { approvedByUserId: actor.userId, approvedAt: new Date() }
          : { rejectedByUserId: actor.userId, rejectedAt: new Date(), rejectionReason }),
      },
    });
  }

  await auditLearning(companyId, actor, 'TrainingNomination', numericId, `${action}_${result.outcome}`, existing, record);
  const event =
    result.outcome === 'APPROVED' ? 'NOMINATION_APPROVED'
    : result.outcome === 'REJECTED' ? 'NOMINATION_REJECTED'
    : result.outcome === 'RETURNED' ? 'NOMINATION_RETURNED'
    : 'NOMINATION_SUBMITTED';
  notifyLearning(companyId, event, {
    moduleCode: 'TRDV',
    sourceEntityType: 'TrainingNomination',
    sourceEntityId: numericId,
    subjectEmpId: record.employeeId,
    linkPath: `/learning/nominations`,
  });

  return NextResponse.json(record);
}
