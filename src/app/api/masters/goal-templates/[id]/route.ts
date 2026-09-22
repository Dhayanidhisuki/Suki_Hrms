import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { goalTemplateSchema } from '@/lib/validations/performance';
import { validateWeightages } from '@/lib/performance/weightage';
import { resolveTemplateLines, snapshotTemplateKpis } from '@/lib/performance/templates';
import { TEMPLATE_LOCK_STATUSES } from '@/lib/performance/copyTemplate';

type Ctx = { params: Promise<{ id: string }> };

const FULL_INCLUDE = {
  kras: {
    include: {
      kra: true,
      kpis: { include: { kpi: true }, orderBy: { id: 'asc' as const } },
    },
    orderBy: { id: 'asc' as const },
  },
};

async function assignmentCount(companyId: number, templateId: number) {
  return prisma.employeeGoalSet.count({
    where: { companyId, templateId, status: { in: [...TEMPLATE_LOCK_STATUSES] } },
  });
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const row = await prisma.goalTemplate.findFirst({
    where: { id: Number((await params).id), companyId: scope.companyId },
    include: FULL_INCLUDE,
  });
  if (!row) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  const lockedByAssignments = await assignmentCount(scope.companyId, row.id);
  return NextResponse.json({ ...row, lockedByAssignments });
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
      select: { id: true, code: true },
    });
    if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const lockedByAssignments = await assignmentCount(scope.companyId, id);
    if (lockedByAssignments > 0) {
      return NextResponse.json(
        {
          error:
            'This template already has active assignments. Clone it as a new version instead of editing in place.',
          lockedByAssignments,
          clone: true,
        },
        { status: 409 }
      );
    }

    const parsed = goalTemplateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    // A template is built today, so today is the date its KRAs must be
    // effective on.
    const resolved = await resolveTemplateLines(scope.companyId, parsed.data.kras, new Date());
    if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

    const weight = validateWeightages(resolved.forValidation);
    if (!weight.valid) {
      return NextResponse.json({ error: 'Weightage validation failed', details: weight.errors }, { status: 400 });
    }

    const code = parsed.data.code ?? existing.code;
    const duplicate = await prisma.goalTemplate.findFirst({
      where: { companyId: scope.companyId, code, NOT: { id } },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: 'A template with this code already exists' }, { status: 409 });

    const { kras, code: _c, ...header } = parsed.data;
    const row = await prisma.$transaction(async (tx) => {
      await tx.goalTemplateKra.deleteMany({ where: { templateId: id } });
      return tx.goalTemplate.update({
        where: { id },
        data: {
          ...header,
          code,
          kras: { create: snapshotTemplateKpis(kras, resolved.kpiById) },
        },
        include: FULL_INCLUDE,
      });
    });
    return NextResponse.json(row);
  } catch (err) {
    console.error('[goal-templates] PUT failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update template' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  return PUT(request, ctx);
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

    const lockedByAssignments = await assignmentCount(scope.companyId, id);
    if (lockedByAssignments > 0) {
      return NextResponse.json(
        { error: 'This template has active assignments. Deactivate it instead of deleting.', clone: true },
        { status: 409 }
      );
    }

    await prisma.goalTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[goal-templates] DELETE failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to delete template' }, { status: 500 });
  }
}
