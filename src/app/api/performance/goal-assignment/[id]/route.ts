import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { canManageGoalsFor, isGoalOwner, resolveActor } from '@/lib/performance/access';

type Ctx = { params: Promise<{ id: string }> };

const FULL_INCLUDE = {
  cycle: true,
  kras: {
    include: {
      kra: { select: { id: true, code: true, name: true, category: true } },
      kpis: {
        include: { kpi: { select: { id: true, code: true, name: true } } },
        orderBy: { id: 'asc' as const },
      },
    },
    orderBy: { id: 'asc' as const },
  },
};

export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const actor = await resolveActor(request, scope.companyId);
    if (!actor) return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });

    const set = await prisma.employeeGoalSet.findFirst({
      where: { id: Number((await params).id), companyId: scope.companyId },
      include: FULL_INCLUDE,
    });
    if (!set) return NextResponse.json({ error: 'Goal set not found' }, { status: 404 });

    const mayView =
      isGoalOwner(actor, set.employeeId) || (await canManageGoalsFor(actor, scope.companyId, set.employeeId));
    if (!mayView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [employee, template] = await Promise.all([
      prisma.employee.findUnique({
        where: { id: set.employeeId },
        select: { id: true, employeeCode: true, firstName: true, lastName: true },
      }),
      set.templateId
        ? prisma.goalTemplate.findUnique({ where: { id: set.templateId }, select: { id: true, code: true, name: true } })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({ ...set, employee, template });
  } catch (err) {
    console.error('[goal-assignment/:id] GET failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load assignment' }, { status: 500 });
  }
}
