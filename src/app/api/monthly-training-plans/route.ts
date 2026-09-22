/**
 * GET  /api/monthly-training-plans — §15 monthly plans (year/month/dept/status
 *      filters, paginated, lines included).
 * POST /api/monthly-training-plans — create a monthly plan with its lines.
 *      `generateFromAnnual: true` copies the matching annual plan's lines
 *      (TrainingPlan.plannedMonth === month) into the new plan.
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

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const departmentId = searchParams.get('departmentId');
  const status = searchParams.get('status');

  const where: Record<string, unknown> = { companyId, deletedAt: null };
  if (year) where.year = parseInt(year);
  if (month) where.month = parseInt(month);
  if (departmentId) where.departmentId = parseInt(departmentId);
  if (status) where.status = status;

  const [data, total] = await Promise.all([
    prisma.monthlyTrainingPlan.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: LINE_INCLUDE,
    }),
    prisma.monthlyTrainingPlan.count({ where }),
  ]);

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = monthlyPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { lines, generateFromAnnual, ...header } = parsed.data;

  // §15: annual plan → monthly plan conversion.
  let generated: typeof lines = [];
  if (generateFromAnnual) {
    const annualLines = await prisma.trainingPlanLine.findMany({
      where: {
        companyId, deletedAt: null, isActive: true, plannedMonth: header.month,
        trainingPlan: { year: String(header.year), deletedAt: null, ...(header.departmentId ? { departmentId: header.departmentId } : {}) },
      },
      include: { trainingProgram: { select: { id: true } } },
    });
    generated = annualLines.map((l) => ({
      trainingProgramId: l.trainingProgramId,
      departmentId: header.departmentId ?? null,
      participantCount: l.participantCount,
      trainerId: l.trainerId,
      method: l.trainingMethod,
      duration: l.duration != null ? Number(l.duration) : null,
      durationUnit: l.durationUnit,
      budget: l.approvedAmount != null ? Number(l.approvedAmount) : null,
      estimatedCost: l.estimatedCost != null ? Number(l.estimatedCost) : null,
      status: 'PLANNED' as const,
    }));
  }

  const allLines = [...lines, ...generated];
  const record = await prisma.monthlyTrainingPlan.create({
    data: {
      companyId,
      trainingPlanId: header.trainingPlanId ?? null,
      year: header.year,
      month: header.month,
      departmentId: header.departmentId ?? null,
      remarks: header.remarks ?? null,
      lines: {
        create: allLines.map((l) => ({ ...l, companyId })),
      },
    },
    include: LINE_INCLUDE,
  });

  await auditLearning(companyId, actor, 'MonthlyTrainingPlan', record.id, 'CREATE', null, record,
    `${header.year}-${String(header.month).padStart(2, '0')} with ${allLines.length} line(s)`);
  return NextResponse.json(record, { status: 201 });
}
