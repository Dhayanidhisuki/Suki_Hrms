import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { trainingPlanLineSchema } from '@/lib/validations/learning';
import { isLearningAdmin } from '@/lib/learning/shared';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!request.headers.get('x-role-id')) return unauthorized();

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const { id } = await params;
  const numericId = parseInt(id);
  const body = await request.json();
  const parsed = trainingPlanLineSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.trainingPlanId) {
    const plan = await prisma.trainingPlan.findFirst({
      where: { id: parsed.data.trainingPlanId, deletedAt: null },
    });
    if (!plan) return NextResponse.json({ error: 'Invalid training plan' }, { status: 400 });
  }

  // Calendar fields: month window must be ordered, internal mentor must be an
  // existing company employee. Merge with the stored line when only one side
  // of the window is updated.
  const needsExisting =
    parsed.data.monthFrom !== undefined || parsed.data.monthTo !== undefined || parsed.data.mentorEmployeeId !== undefined;
  const existing = needsExisting
    ? await prisma.trainingPlanLine.findFirst({ where: { id: numericId, companyId, deletedAt: null } })
    : null;
  if (needsExisting && !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const effFrom = parsed.data.monthFrom !== undefined ? parsed.data.monthFrom : existing?.monthFrom;
  const effTo = parsed.data.monthTo !== undefined ? parsed.data.monthTo : existing?.monthTo;
  if (effFrom != null && effTo != null && effTo < effFrom) {
    return NextResponse.json({ error: 'To Month must be on or after From Month' }, { status: 400 });
  }
  if (parsed.data.mentorEmployeeId) {
    const mentor = await prisma.employee.findFirst({ where: { id: parsed.data.mentorEmployeeId, companyId } });
    if (!mentor) return NextResponse.json({ error: 'Invalid mentor employee' }, { status: 400 });
  }

  const enums = {
    traineeCategory: parsed.data.traineeCategory === null ? null : parsed.data.traineeCategory?.toUpperCase(),
    mentorType: parsed.data.mentorType === null ? null : parsed.data.mentorType?.toUpperCase(),
    schedulePeriod: parsed.data.schedulePeriod === null ? null : parsed.data.schedulePeriod?.toUpperCase(),
  };

  const nextStatus = parsed.data.status?.toUpperCase();

  // BRD §51: a plan line cannot be approved if it would push the matching
  // department/year TrainingBudget over its allocated amount. Only applies
  // when a budget exists — absence of a budget never blocks approval.
  if (nextStatus === 'APPROVED') {
    const line = await prisma.trainingPlanLine.findFirst({
      where: { id: numericId, companyId, deletedAt: null },
      include: { trainingPlan: { select: { year: true, departmentId: true } } },
    });
    if (!line) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const year = line.trainingPlan?.year;
    if (year) {
      const budget = await prisma.trainingBudget.findFirst({
        where: {
          companyId,
          year,
          deletedAt: null,
          isActive: true,
          OR: [
            { departmentId: line.trainingPlan?.departmentId ?? null },
            { departmentId: null },
          ],
        },
        orderBy: { departmentId: 'desc' }, // prefer the dept-specific budget
      });
      if (budget) {
        const cost = parsed.data.estimatedCost ?? line.estimatedCost?.toNumber() ?? 0;
        const projected = budget.utilizedAmount.toNumber() + cost;
        if (projected > budget.allocatedAmount.toNumber()) {
          return NextResponse.json(
            {
              error: `Approving this line would exceed the ${year} training budget (allocated ₹${budget.allocatedAmount.toNumber().toLocaleString('en-IN')}, would reach ₹${projected.toLocaleString('en-IN')})`,
            },
            { status: 400 }
          );
        }
        const record = await prisma.$transaction(async (tx) => {
          const updated = await tx.trainingPlanLine.update({
            where: { id: numericId },
            data: { ...parsed.data, ...enums, status: nextStatus, priority: parsed.data.priority?.toUpperCase() },
          });
          await tx.trainingBudget.update({
            where: { id: budget.id },
            data: { utilizedAmount: { increment: cost } },
          });
          return updated;
        });
        return NextResponse.json(record);
      }
    }
  }

  const record = await prisma.trainingPlanLine.update({
    where: { id: numericId },
    data: {
      ...parsed.data,
      ...enums,
      status: nextStatus,
      priority: parsed.data.priority?.toUpperCase(),
    },
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
  const record = await prisma.trainingPlanLine.findFirst({
    where: { id: parseInt(id), companyId, deletedAt: null },
  });
  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // §51: mandatory plan lines cannot be deleted once assigned (admins exempt).
  if (record.isMandatory && !(await isLearningAdmin(request))) {
    return NextResponse.json({ error: 'Mandatory training plan lines cannot be deleted' }, { status: 400 });
  }

  await prisma.trainingPlanLine.update({
    where: { id: parseInt(id) },
    data: { deletedAt: new Date(), isActive: false },
  });

  return NextResponse.json({ message: 'Soft-deleted' }, { status: 200 });
}
