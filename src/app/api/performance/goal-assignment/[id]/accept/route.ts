import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { isGoalOwner, resolveActor } from '@/lib/performance/access';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const actor = await resolveActor(request, scope.companyId);
    if (!actor) return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
    const id = Number((await params).id);

    const set = await prisma.employeeGoalSet.findFirst({
      where: { id, companyId: scope.companyId },
      include: { cycle: { select: { status: true } } },
    });
    if (!set) return NextResponse.json({ error: 'Goal set not found' }, { status: 404 });
    if (!isGoalOwner(actor, set.employeeId)) {
      return NextResponse.json({ error: 'Forbidden — only the employee can accept their own goals' }, { status: 403 });
    }
    if (set.status !== 'PENDING_ACCEPTANCE') {
      return NextResponse.json({ error: `These goals are not awaiting acceptance (status is ${set.status})` }, { status: 409 });
    }
    if (set.cycle.status !== 'ACTIVE') {
      return NextResponse.json({ error: `The cycle is ${set.cycle.status} and is read-only` }, { status: 409 });
    }

    const updated = await prisma.employeeGoalSet.update({
      where: { id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[goal-assignment] accept failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to accept goals' }, { status: 500 });
  }
}
