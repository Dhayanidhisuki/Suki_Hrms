import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { kpiSchema } from '@/lib/validations/performance';
import { validateTargetForType } from '@/lib/performance/measurement';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const row = await prisma.kpi.findFirst({
    where: { id: Number((await params).id), companyId: scope.companyId },
    include: { kra: { select: { id: true, code: true, name: true } } },
  });
  if (!row) return NextResponse.json({ error: 'KPI not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const id = Number((await params).id);

    const existing = await prisma.kpi.findFirst({ where: { id, companyId: scope.companyId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'KPI not found' }, { status: 404 });

    const parsed = kpiSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const targetErr = validateTargetForType(parsed.data.measurementType, parsed.data.target, {
      minThreshold: parsed.data.minThreshold,
      maxTarget: parsed.data.maxTarget,
    });
    if (targetErr) return NextResponse.json({ error: targetErr }, { status: 400 });

    const kra = await prisma.kra.findFirst({
      where: { id: parsed.data.kraId, companyId: scope.companyId },
      select: { id: true },
    });
    if (!kra) return NextResponse.json({ error: 'KRA not found' }, { status: 404 });

    const duplicate = await prisma.kpi.findFirst({
      where: { companyId: scope.companyId, code: parsed.data.code, NOT: { id } },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: 'A KPI with this code already exists' }, { status: 409 });

    const row = await prisma.kpi.update({ where: { id }, data: parsed.data });
    return NextResponse.json(row);
  } catch (err) {
    console.error('[kpi] PUT failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update KPI' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const id = Number((await params).id);

    const row = await prisma.kpi.findFirst({
      where: { id, companyId: scope.companyId },
      include: { _count: { select: { templateKpis: true, goalKpis: true } } },
    });
    if (!row) return NextResponse.json({ error: 'KPI not found' }, { status: 404 });

    const { templateKpis, goalKpis } = row._count;
    if (templateKpis || goalKpis) {
      return NextResponse.json(
        {
          error: 'This KPI is in use and cannot be deleted. Set its status to Inactive instead.',
          inUse: { templates: templateKpis, assignedGoals: goalKpis },
        },
        { status: 409 }
      );
    }

    await prisma.kpi.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[kpi] DELETE failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to delete KPI' }, { status: 500 });
  }
}
