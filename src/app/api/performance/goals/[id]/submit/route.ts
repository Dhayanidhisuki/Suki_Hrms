import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { canManageGoalsFor, resolveActor } from '@/lib/performance/access';
import { validateKpiDates, validateWeightages } from '@/lib/performance/weightage';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Manager submits goals for employee acceptance — DRAFT/RETURNED →
 * PENDING_ACCEPTANCE.
 *
 * Revalidates from the stored rows rather than trusting that the last PUT
 * left the set valid: apply-template writes lines without a weightage check
 * (a template's 100/100 is checked when the template is saved, but its KRAs
 * could have been edited since), so this is the gate that guarantees no
 * invalid set ever reaches an employee.
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
      include: {
        cycle: true,
        kras: { include: { kra: true, kpis: { include: { kpi: { select: { code: true } } } } } },
      },
    });
    if (!set) return NextResponse.json({ error: 'Goal set not found' }, { status: 404 });

    if (!(await canManageGoalsFor(actor, scope.companyId, set.employeeId))) {
      return NextResponse.json({ error: 'Forbidden — you do not manage this employee' }, { status: 403 });
    }
    if (set.status !== 'DRAFT' && set.status !== 'RETURNED') {
      return NextResponse.json({ error: `Only a Draft or Returned goal set can be submitted (this one is ${set.status})` }, { status: 409 });
    }
    if (set.cycle.status !== 'ACTIVE') {
      return NextResponse.json({ error: `The cycle is ${set.cycle.status} and is read-only` }, { status: 409 });
    }

    const weight = validateWeightages(
      set.kras.map((k) => ({
        label: k.kra.code,
        weightage: Number(k.weightage),
        kpis: k.kpis.map((p) => ({ label: p.kpi.code, weightage: Number(p.weightage) })),
      }))
    );
    if (!weight.valid) {
      return NextResponse.json({ error: 'Weightage validation failed', details: weight.errors }, { status: 400 });
    }

    const dateErrors = validateKpiDates(
      set.kras.flatMap((k) => k.kpis.map((p) => ({ label: p.kpi.code, startDate: p.startDate, endDate: p.endDate }))),
      { startDate: set.cycle.startDate, endDate: set.cycle.endDate }
    );
    if (dateErrors.length) {
      return NextResponse.json({ error: 'Date validation failed', details: dateErrors }, { status: 400 });
    }

    const updated = await prisma.employeeGoalSet.update({
      where: { id },
      data: { status: 'PENDING_ACCEPTANCE', submittedAt: new Date(), returnedAt: null },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[performance/goals/:id/submit] POST failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to submit goals' }, { status: 500 });
  }
}
