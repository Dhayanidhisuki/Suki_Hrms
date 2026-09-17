import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { kpiSchema } from '@/lib/validations/performance';
import { validateTargetForType } from '@/lib/performance/measurement';

/** BRD §9 — KPI master. Every KPI belongs to exactly one KRA. */
export async function GET(request: NextRequest) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;

    const sp = request.nextUrl.searchParams;
    const search = sp.get('search')?.trim();
    const kraId = sp.get('kraId');
    const status = sp.get('status');

    const data = await prisma.kpi.findMany({
      where: {
        companyId: scope.companyId,
        ...(kraId ? { kraId: Number(kraId) } : {}),
        ...(status ? { status } : {}),
        ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}),
      },
      include: { kra: { select: { id: true, code: true, name: true } } },
      orderBy: [{ kraId: 'asc' }, { code: 'asc' }],
    });

    return NextResponse.json({
      data,
      pagination: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
    });
  } catch (err) {
    console.error('[kpi] GET failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load KPIs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;

    const parsed = kpiSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const targetErr = validateTargetForType(parsed.data.measurementType, parsed.data.target);
    if (targetErr) return NextResponse.json({ error: targetErr }, { status: 400 });

    // Confirm the parent KRA is this company's — the FK alone is cross-tenant.
    const kra = await prisma.kra.findFirst({
      where: { id: parsed.data.kraId, companyId: scope.companyId },
      select: { id: true },
    });
    if (!kra) return NextResponse.json({ error: 'KRA not found' }, { status: 404 });

    const duplicate = await prisma.kpi.findFirst({
      where: { companyId: scope.companyId, code: parsed.data.code },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: 'A KPI with this code already exists' }, { status: 409 });

    const row = await prisma.kpi.create({ data: { companyId: scope.companyId, ...parsed.data } });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('[kpi] POST failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create KPI' }, { status: 500 });
  }
}
