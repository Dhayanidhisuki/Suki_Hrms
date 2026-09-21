import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { goalTemplateSchema } from '@/lib/validations/performance';
import { validateWeightages } from '@/lib/performance/weightage';
import { resolveTemplateLines, snapshotTemplateKpis } from '@/lib/performance/templates';
import { allocateTemplateCode } from '@/lib/performance/templateCode';

const LIST_INCLUDE = {
  kras: {
    include: {
      kra: { select: { id: true, code: true, name: true } },
      kpis: {
        include: { kpi: { select: { id: true, code: true, name: true } } },
        orderBy: { id: 'asc' as const },
      },
    },
    orderBy: { id: 'asc' as const },
  },
};

/**
 * Goal templates — reusable KRA+KPI bundles. Filter is exact on the
 * header's department/designation when those query params are set.
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
        ...(departmentId ? { departmentId: Number(departmentId) } : {}),
        ...(designationId ? { designationId: Number(designationId) } : {}),
        ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}),
      },
      include: { ...LIST_INCLUDE, _count: { select: { kras: true } } },
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

    // A template is built today, so today is the date its KRAs must be
    // effective on.
    const resolved = await resolveTemplateLines(scope.companyId, parsed.data.kras, new Date());
    if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

    const weight = validateWeightages(resolved.forValidation);
    if (!weight.valid) {
      return NextResponse.json({ error: 'Weightage validation failed', details: weight.errors }, { status: 400 });
    }

    const code = parsed.data.code ?? (await allocateTemplateCode(scope.companyId));
    const duplicate = await prisma.goalTemplate.findFirst({
      where: { companyId: scope.companyId, code },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: 'A template with this code already exists' }, { status: 409 });

    const createdByUserId = Number(request.headers.get('x-user-id')) || null;
    const { kras, code: _ignored, ...header } = parsed.data;
    const row = await prisma.goalTemplate.create({
      data: {
        companyId: scope.companyId,
        ...header,
        code,
        createdByUserId,
        kras: { create: snapshotTemplateKpis(kras, resolved.kpiById) },
      },
      include: LIST_INCLUDE,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('[goal-templates] POST failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create template' }, { status: 500 });
  }
}
