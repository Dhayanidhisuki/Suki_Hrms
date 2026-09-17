import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { applyTemplateSchema } from '@/lib/validations/performance';
import { canManageGoalsFor, resolveActor } from '@/lib/performance/access';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Seed a goal set from a template.
 *
 * Template defaults are *copied*, not referenced: a later edit to the
 * template or the KPI master must not rewrite goals already assigned. KPI
 * dates default to the full cycle window, which satisfies BRD §41 by
 * construction; the manager narrows them afterwards.
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
      include: { cycle: true, _count: { select: { kras: true } } },
    });
    if (!set) return NextResponse.json({ error: 'Goal set not found' }, { status: 404 });

    if (!(await canManageGoalsFor(actor, scope.companyId, set.employeeId))) {
      return NextResponse.json({ error: 'Forbidden — you do not manage this employee' }, { status: 403 });
    }
    if (set.status !== 'DRAFT' && set.status !== 'RETURNED') {
      return NextResponse.json({ error: `A template can only be applied to a Draft or Returned goal set (this one is ${set.status})` }, { status: 409 });
    }
    if (set.cycle.status !== 'ACTIVE') {
      return NextResponse.json({ error: `The cycle is ${set.cycle.status} and is read-only` }, { status: 409 });
    }

    const parsed = applyTemplateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    if (set._count.kras > 0 && !parsed.data.replaceExisting) {
      return NextResponse.json(
        { error: 'This goal set already has KRAs. Re-send with replaceExisting to overwrite them.' },
        { status: 409 }
      );
    }

    const template = await prisma.goalTemplate.findFirst({
      where: { id: parsed.data.templateId, companyId: scope.companyId },
      include: { kras: { include: { kpis: { include: { kpi: true } } }, orderBy: { id: 'asc' } } },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    if (template.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'This template is inactive' }, { status: 409 });
    }
    if (template.kras.length === 0) {
      return NextResponse.json({ error: 'This template has no KRAs' }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.employeeGoalKra.deleteMany({ where: { goalSetId: id } });
      return tx.employeeGoalSet.update({
        where: { id },
        data: {
          templateId: template.id,
          kras: {
            create: template.kras.map((tk) => ({
              kraId: tk.kraId,
              weightage: tk.weightage,
              kpis: {
                create: tk.kpis.map((tp) => ({
                  kpiId: tp.kpiId,
                  // Snapshot the master's descriptive fields; the template
                  // only overrides target and weightage.
                  description: tp.kpi.description,
                  measurementType: tp.kpi.measurementType,
                  unit: tp.kpi.unit,
                  target: tp.target,
                  minThreshold: tp.kpi.minThreshold,
                  maxTarget: tp.kpi.maxTarget,
                  weightage: tp.weightage,
                  startDate: set.cycle.startDate,
                  endDate: set.cycle.endDate,
                  frequency: tp.kpi.frequency,
                })),
              },
            })),
          },
        },
        include: {
          cycle: true,
          kras: {
            include: { kra: true, kpis: { include: { kpi: true }, orderBy: { id: 'asc' } } },
            orderBy: { id: 'asc' },
          },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[performance/goals/:id/apply-template] POST failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to apply template' }, { status: 500 });
  }
}
