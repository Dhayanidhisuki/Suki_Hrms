/**
 * GET  /api/training-cost-items — §34 cost line items, filterable by
 *      scheduleId / externalTrainingId / head.
 * POST /api/training-cost-items — add a cost item. Syncs the matching
 *      TrainingBudget.utilizedAmount and enforces §51 (over-approved spend
 *      is rejected unless ?override=1 is sent by an admin).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { trainingCostItemSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning, isLearningAdmin, resolveBudget, budgetExceeded, adjustBudgetUtilization } from '@/lib/learning/shared';

const COST_SELECT = { id: true, scheduledDate: true, targetDepartmentId: true } as const;

async function budgetScopeFor(companyId: number, scheduleId: number | null, externalId: number | null) {
  if (scheduleId) {
    const s = await prisma.trainingSchedule.findFirst({ where: { id: scheduleId, companyId }, select: COST_SELECT });
    return s ? { year: String(s.scheduledDate?.getFullYear() ?? new Date().getFullYear()), departmentId: s.targetDepartmentId } : null;
  }
  if (externalId) {
    const e = await prisma.externalTraining.findFirst({ where: { id: externalId, companyId }, select: { startDate: true } });
    return e ? { year: String(e.startDate?.getFullYear() ?? new Date().getFullYear()), departmentId: null } : null;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const where: Record<string, unknown> = { companyId, deletedAt: null };
  if (searchParams.get('scheduleId')) where.trainingScheduleId = parseInt(searchParams.get('scheduleId')!);
  if (searchParams.get('externalTrainingId')) where.externalTrainingId = parseInt(searchParams.get('externalTrainingId')!);
  if (searchParams.get('head')) where.head = searchParams.get('head');

  const data = await prisma.trainingCostItem.findMany({ where, orderBy: { createdAt: 'desc' } });
  const total = data.reduce((s, i) => s + Number(i.amount), 0);
  return NextResponse.json({ data, total });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = trainingCostItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { trainingScheduleId, externalTrainingId, head, amount, description } = parsed.data;
  if (!trainingScheduleId && !externalTrainingId) {
    return NextResponse.json({ error: 'Link the cost to a schedule or an external training' }, { status: 400 });
  }

  const scope = await budgetScopeFor(companyId, trainingScheduleId ?? null, externalTrainingId ?? null);
  if (scope) {
    const budget = await resolveBudget(companyId, scope.year, scope.departmentId);
    const msg = budgetExceeded(budget, amount);
    if (msg && !(request.nextUrl.searchParams.get('override') === '1' && (await isLearningAdmin(request)))) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
  }

  const record = await prisma.trainingCostItem.create({
    data: { companyId, trainingScheduleId, externalTrainingId, head, amount, description: description ?? null },
  });
  if (scope) await adjustBudgetUtilization(companyId, scope.year, scope.departmentId, amount);

  await auditLearning(companyId, actor, 'TrainingCostItem', record.id, 'CREATE', null, record, `${head} ${amount}`);
  return NextResponse.json(record, { status: 201 });
}
