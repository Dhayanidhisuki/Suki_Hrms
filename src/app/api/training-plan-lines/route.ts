import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { trainingPlanLineSchema } from '@/lib/validations/learning';
import { resolveBudget, budgetExceeded, isLearningAdmin } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  if (!request.headers.get('x-role-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const trainingPlanId = searchParams.get('trainingPlanId');
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const status = searchParams.get('status');

  const where: Record<string, unknown> = { companyId, deletedAt: null };
  if (trainingPlanId) where.trainingPlanId = parseInt(trainingPlanId);
  if (month) where.plannedMonth = parseInt(month);
  if (status) where.status = status.toUpperCase();
  if (year) where.trainingPlan = { year, deletedAt: null };

  const [data, total] = await Promise.all([
    prisma.trainingPlanLine.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        trainingPlan: { select: { id: true, year: true, title: true } },
        trainingProgram: { select: { id: true, code: true, name: true } },
        competency: { select: { id: true, name: true } },
      },
    }),
    prisma.trainingPlanLine.count({ where }),
  ]);

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  if (!request.headers.get('x-role-id')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const companyCheck = getCompanyId(request);
  if ('error' in companyCheck) return companyCheck.error;
  const { companyId } = companyCheck;

  const body = await request.json();
  const parsed = trainingPlanLineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { trainingPlanId, trainingProgramId, estimatedCost, monthFrom, monthTo, mentorType, mentorEmployeeId } = parsed.data;
  if (monthFrom != null && monthTo != null && monthTo < monthFrom) {
    return NextResponse.json({ error: 'To Month must be on or after From Month' }, { status: 400 });
  }
  const plan = await prisma.trainingPlan.findFirst({
    where: { id: trainingPlanId, companyId, deletedAt: null },
  });
  const program = await prisma.trainingProgram.findFirst({
    where: { id: trainingProgramId, companyId, deletedAt: null },
  });
  if (!plan || !program) {
    return NextResponse.json(
      { error: 'Invalid training plan or program' },
      { status: 400 }
    );
  }
  // Internal mentor must be an existing employee of this company.
  if (mentorType === 'INTERNAL' && mentorEmployeeId) {
    const mentor = await prisma.employee.findFirst({ where: { id: mentorEmployeeId, companyId } });
    if (!mentor) return NextResponse.json({ error: 'Invalid mentor employee' }, { status: 400 });
  }

  // §51: planned spend may not exceed the approved budget without admin
  // override (?override=1). Committed = existing lines' estimated cost.
  const lineCost = Number(estimatedCost ?? 0);
  if (lineCost > 0) {
    const budget = await resolveBudget(companyId, String(plan.year), plan.departmentId ?? null);
    if (budget) {
      const committed = await prisma.trainingPlanLine.aggregate({
        where: { trainingPlanId, companyId, deletedAt: null, isActive: true },
        _sum: { estimatedCost: true },
      });
      const msg = budgetExceeded(
        { ...budget, utilizedAmount: committed._sum.estimatedCost ?? 0 },
        lineCost,
      );
      if (msg && !(request.nextUrl.searchParams.get('override') === '1' && (await isLearningAdmin(request)))) {
        return NextResponse.json({ error: msg }, { status: 409 });
      }
    }
  }

  const record = await prisma.trainingPlanLine.create({
    data: {
      ...parsed.data,
      companyId,
      status: parsed.data.status.toUpperCase(),
      priority: parsed.data.priority.toUpperCase(),
      traineeCategory: parsed.data.traineeCategory === null ? null : parsed.data.traineeCategory?.toUpperCase(),
      mentorType: parsed.data.mentorType === null ? null : parsed.data.mentorType?.toUpperCase(),
      schedulePeriod: parsed.data.schedulePeriod === null ? null : parsed.data.schedulePeriod?.toUpperCase(),
    },
  });

  return NextResponse.json(record, { status: 201 });
}
