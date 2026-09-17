import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { saveGoalSetSchema } from '@/lib/validations/performance';
import { canManageGoalsFor, isGoalOwner, resolveActor } from '@/lib/performance/access';
import { resolveTemplateLines } from '@/lib/performance/templates';
import { validateKpiDates, validateWeightages } from '@/lib/performance/weightage';
import { validateTargetForType } from '@/lib/performance/measurement';

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

    const employee = await prisma.employee.findUnique({
      where: { id: set.employeeId },
      // Department/designation live on the related JobInfo, not Employee, and
      // the goal screens only show the name — so don't reach for them here.
      select: { id: true, employeeCode: true, firstName: true, lastName: true },
    });

    return NextResponse.json({ ...set, employee });
  } catch (err) {
    console.error('[performance/goals/:id] GET failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load goal set' }, { status: 500 });
  }
}

/**
 * Replace the whole KRA/KPI structure on a DRAFT (or RETURNED) goal set.
 *
 * This is where BRD §17 Model A and §41 are enforced for an individually
 * customised set — a template being valid does not exempt the result, because
 * the manager may have edited weightages after applying it.
 */
export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const actor = await resolveActor(request, scope.companyId);
    if (!actor) return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
    const id = Number((await params).id);

    const set = await prisma.employeeGoalSet.findFirst({
      where: { id, companyId: scope.companyId },
      include: { cycle: true },
    });
    if (!set) return NextResponse.json({ error: 'Goal set not found' }, { status: 404 });

    if (!(await canManageGoalsFor(actor, scope.companyId, set.employeeId))) {
      return NextResponse.json({ error: 'Forbidden — you do not manage this employee' }, { status: 403 });
    }
    if (set.status === 'ACCEPTED') {
      return NextResponse.json({ error: 'Accepted goals are read-only' }, { status: 409 });
    }
    if (set.status === 'PENDING_ACCEPTANCE') {
      return NextResponse.json(
        { error: 'These goals are awaiting employee acceptance. Ask the employee to return them before editing.' },
        { status: 409 }
      );
    }
    if (set.cycle.status !== 'ACTIVE') {
      return NextResponse.json({ error: `The cycle is ${set.cycle.status} and is read-only` }, { status: 409 });
    }

    const parsed = saveGoalSetSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const resolved = await resolveTemplateLines(scope.companyId, parsed.data.kras);
    if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

    // BRD §17 Model A — 100% across KRAs, 100% within each KRA.
    const weight = validateWeightages(resolved.forValidation);
    if (!weight.valid) {
      return NextResponse.json({ error: 'Weightage validation failed', details: weight.errors }, { status: 400 });
    }

    // BRD §41 — KPI window inside the cycle window.
    const allKpis = parsed.data.kras.flatMap((k) => k.kpis);
    const dateErrors = validateKpiDates(
      allKpis.map((k) => ({
        label: resolved.kpiById.get(k.kpiId)!.code,
        startDate: k.startDate,
        endDate: k.endDate,
      })),
      { startDate: set.cycle.startDate, endDate: set.cycle.endDate }
    );
    if (dateErrors.length) {
      return NextResponse.json({ error: 'Date validation failed', details: dateErrors }, { status: 400 });
    }

    // BRD §10 — a rating KPI cannot be given an out-of-scale target.
    const targetErrors = allKpis
      .map((k) => {
        const err = validateTargetForType(k.measurementType, k.target);
        return err ? `KPI "${resolved.kpiById.get(k.kpiId)!.code}": ${err}` : null;
      })
      .filter((e): e is string => e != null);
    if (targetErrors.length) {
      return NextResponse.json({ error: 'Target validation failed', details: targetErrors }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.employeeGoalKra.deleteMany({ where: { goalSetId: id } });
      return tx.employeeGoalSet.update({
        where: { id },
        data: {
          kras: {
            create: parsed.data.kras.map((k) => ({
              kraId: k.kraId,
              weightage: k.weightage,
              kpis: {
                create: k.kpis.map((p) => ({
                  kpiId: p.kpiId,
                  description: p.description,
                  measurementType: p.measurementType,
                  unit: p.unit,
                  target: p.target,
                  minThreshold: p.minThreshold ?? null,
                  maxTarget: p.maxTarget ?? null,
                  weightage: p.weightage,
                  startDate: p.startDate,
                  endDate: p.endDate,
                  frequency: p.frequency,
                  evidenceRequired: p.evidenceRequired,
                  employeeComments: p.employeeComments ?? null,
                  managerComments: p.managerComments ?? null,
                })),
              },
            })),
          },
        },
        include: FULL_INCLUDE,
      });
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[performance/goals/:id] PUT failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save goals' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const actor = await resolveActor(request, scope.companyId);
    if (!actor) return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
    const id = Number((await params).id);

    const set = await prisma.employeeGoalSet.findFirst({
      where: { id, companyId: scope.companyId },
      select: { id: true, employeeId: true, status: true },
    });
    if (!set) return NextResponse.json({ error: 'Goal set not found' }, { status: 404 });
    if (!(await canManageGoalsFor(actor, scope.companyId, set.employeeId))) {
      return NextResponse.json({ error: 'Forbidden — you do not manage this employee' }, { status: 403 });
    }
    if (set.status === 'ACCEPTED') {
      return NextResponse.json({ error: 'Accepted goals cannot be deleted' }, { status: 409 });
    }

    await prisma.employeeGoalSet.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[performance/goals/:id] DELETE failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to delete goal set' }, { status: 500 });
  }
}
