import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { goalTemplateSchema } from '@/lib/validations/performance';
import { validateWeightages } from '@/lib/performance/weightage';
import { resolveTemplateLines } from '@/lib/performance/templates';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const row = await prisma.goalTemplate.findFirst({
    where: { id: Number((await params).id), companyId: scope.companyId },
    include: {
      kras: {
        include: { kra: true, kpis: { include: { kpi: true } } },
        orderBy: { id: 'asc' },
      },
    },
  });
  if (!row) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const id = Number((await params).id);

    const existing = await prisma.goalTemplate.findFirst({
      where: { id, companyId: scope.companyId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const parsed = goalTemplateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const resolved = await resolveTemplateLines(scope.companyId, parsed.data.kras);
    if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

    const weight = validateWeightages(resolved.forValidation);
    if (!weight.valid) {
      return NextResponse.json({ error: 'Weightage validation failed', details: weight.errors }, { status: 400 });
    }

    const duplicate = await prisma.goalTemplate.findFirst({
      where: { companyId: scope.companyId, code: parsed.data.code, NOT: { id } },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: 'A template with this code already exists' }, { status: 409 });

    const { kras, ...header } = parsed.data;
    // Lines are rewritten wholesale: the builder always submits the full set,
    // and GoalTemplateKra cascades to its KPIs.
    const row = await prisma.$transaction(async (tx) => {
      await tx.goalTemplateKra.deleteMany({ where: { templateId: id } });
      return tx.goalTemplate.update({
        where: { id },
        data: {
          ...header,
          kras: {
            create: kras.map((k) => ({
              kraId: k.kraId,
              weightage: k.weightage,
              kpis: { create: k.kpis.map((p) => ({ kpiId: p.kpiId, target: p.target, weightage: p.weightage })) },
            })),
          },
        },
        include: { kras: { include: { kpis: true } } },
      });
    });
    return NextResponse.json(row);
  } catch (err) {
    console.error('[goal-templates] PUT failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const id = Number((await params).id);

    const row = await prisma.goalTemplate.findFirst({ where: { id, companyId: scope.companyId }, select: { id: true } });
    if (!row) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // EmployeeGoalSet.templateId is provenance only (no FK), so deleting a
    // template never orphans assigned goals — they carry their own snapshot.
    await prisma.goalTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[goal-templates] DELETE failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to delete template' }, { status: 500 });
  }
}
