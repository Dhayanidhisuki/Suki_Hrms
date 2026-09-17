import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { acceptGoalSetSchema } from '@/lib/validations/performance';
import { isGoalOwner, resolveActor } from '@/lib/performance/access';

type Ctx = { params: Promise<{ id: string }> };

/**
 * BRD §17 — the employee's own response: accept the goals, or return them to
 * the manager for rework. Only the employee the goals belong to may do this;
 * HR deliberately cannot accept on someone's behalf, since acceptance is the
 * employee's acknowledgement.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
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
      return NextResponse.json({ error: 'Forbidden — only the employee can respond to their own goals' }, { status: 403 });
    }
    if (set.status !== 'PENDING_ACCEPTANCE') {
      return NextResponse.json({ error: `These goals are not awaiting your acceptance (status is ${set.status})` }, { status: 409 });
    }
    if (set.cycle.status !== 'ACTIVE') {
      return NextResponse.json({ error: `The cycle is ${set.cycle.status} and is read-only` }, { status: 409 });
    }

    const parsed = acceptGoalSetSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const now = new Date();
    const updated = await prisma.employeeGoalSet.update({
      where: { id },
      data:
        parsed.data.action === 'ACCEPT'
          ? { status: 'ACCEPTED', acceptedAt: now, employeeRemark: parsed.data.employeeRemark ?? null }
          : { status: 'RETURNED', returnedAt: now, employeeRemark: parsed.data.employeeRemark ?? null },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[performance/goals/:id/respond] POST failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to record response' }, { status: 500 });
  }
}
