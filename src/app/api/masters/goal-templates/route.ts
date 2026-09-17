import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { goalTemplateSchema } from '@/lib/validations/performance';
import { validateWeightages } from '@/lib/performance/weightage';
import { resolveTemplateLines } from '@/lib/performance/templates';

/**
 * Goal templates — a reusable KRA+KPI bundle with default weightages.
 * departmentId/designationId are a suggestion filter for which templates
 * surface first on an employee, not an auto-assignment rule.
 */
export async function GET(request: NextRequest) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;

    const sp = request.nextUrl.searchParams;
    const search = sp.get('search')?.trim();
    const status = sp.get('status');
    const departmentId = sp.get('departmentId');
    const designationId = sp.get('designationId');

    const data = await prisma.goalTemplate.findMany({
      where: {
        companyId: scope.companyId,
        ...(status ? { status } : {}),
        // A template with no scope applies anywhere, so a scoped search must
        // still surface the unscoped ones.
        ...(departmentId ? { OR: [{ departmentId: Number(departmentId) }, { departmentId: null }] } : {}),
        ...(designationId ? { AND: [{ OR: [{ designationId: Number(designationId) }, { designationId: null }] }] } : {}),
        ...(search ? { AND: [{ OR: [{ code: { contains: search } }, { name: { contains: search } }] }] } : {}),
      },
      include: {
        kras: {
          include: {
            kra: { select: { id: true, code: true, name: true } },
            kpis: { include: { kpi: { select: { id: true, code: true, name: true, unit: true, measurementType: true } } } },
          },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });

    return NextResponse.json({
      data,
      pagination: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
    });
  } catch (err) {
    console.error('[goal-templates] GET failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;

    const parsed = goalTemplateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const resolved = await resolveTemplateLines(scope.companyId, parsed.data.kras);
    if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

    // BRD §17 Model A — same check the goal-assignment API runs.
    const weight = validateWeightages(resolved.forValidation);
    if (!weight.valid) {
      return NextResponse.json({ error: 'Weightage validation failed', details: weight.errors }, { status: 400 });
    }

    const duplicate = await prisma.goalTemplate.findFirst({
      where: { companyId: scope.companyId, code: parsed.data.code },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: 'A template with this code already exists' }, { status: 409 });

    const { kras, ...header } = parsed.data;
    const row = await prisma.goalTemplate.create({
      data: {
        companyId: scope.companyId,
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
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('[goal-templates] POST failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create template' }, { status: 500 });
  }
}
