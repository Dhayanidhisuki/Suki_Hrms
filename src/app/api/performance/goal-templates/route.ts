import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveActor } from '@/lib/performance/access';

/** Active templates for the assignment picker — not a master CRUD surface. */
export async function GET(request: NextRequest) {
  try {
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const actor = await resolveActor(request, scope.companyId);
    if (!actor) return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });

    const departmentId = request.nextUrl.searchParams.get('departmentId');
    const designationId = request.nextUrl.searchParams.get('designationId');

    const data = await prisma.goalTemplate.findMany({
      where: {
        companyId: scope.companyId,
        status: 'ACTIVE',
        ...(departmentId ? { OR: [{ departmentId: Number(departmentId) }, { departmentId: null }] } : {}),
        ...(designationId ? { OR: [{ designationId: Number(designationId) }, { designationId: null }] } : {}),
      },
      include: {
        kras: {
          include: {
            kra: { select: { id: true, code: true, name: true } },
            kpis: { include: { kpi: { select: { id: true, code: true, name: true } } }, orderBy: { id: 'asc' } },
          },
          orderBy: { id: 'asc' },
        },
        _count: { select: { kras: true } },
      },
      orderBy: { code: 'asc' },
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[performance/goal-templates] GET failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load templates' }, { status: 500 });
  }
}
