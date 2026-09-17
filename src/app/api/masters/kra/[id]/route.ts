import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { kraSchema } from '@/lib/validations/performance';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const row = await prisma.kra.findFirst({
    where: { id: Number((await params).id), companyId: scope.companyId },
    include: { kpis: { orderBy: { code: 'asc' } } },
  });
  if (!row) return NextResponse.json({ error: 'KRA not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const id = Number((await params).id);

    const existing = await prisma.kra.findFirst({ where: { id, companyId: scope.companyId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'KRA not found' }, { status: 404 });

    const parsed = kraSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const duplicate = await prisma.kra.findFirst({
      where: { companyId: scope.companyId, code: parsed.data.code, NOT: { id } },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: 'A KRA with this code already exists' }, { status: 409 });

    const row = await prisma.kra.update({ where: { id }, data: parsed.data });
    return NextResponse.json(row);
  } catch (err) {
    console.error('[kra] PUT failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update KRA' }, { status: 500 });
  }
}

/**
 * Hard delete, but only while nothing references the KRA — templates and
 * assigned goals both FK to it with NO ACTION, so the DB would reject the
 * delete anyway; this returns a usable message instead of a constraint error.
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const id = Number((await params).id);

    const row = await prisma.kra.findFirst({
      where: { id, companyId: scope.companyId },
      include: { _count: { select: { kpis: true, templateKras: true, goalKras: true } } },
    });
    if (!row) return NextResponse.json({ error: 'KRA not found' }, { status: 404 });

    const { kpis, templateKras, goalKras } = row._count;
    if (kpis || templateKras || goalKras) {
      return NextResponse.json(
        {
          error:
            'This KRA is in use and cannot be deleted. Set its status to Inactive instead.',
          inUse: { kpis, templates: templateKras, assignedGoals: goalKras },
        },
        { status: 409 }
      );
    }

    await prisma.kra.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[kra] DELETE failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to delete KRA' }, { status: 500 });
  }
}
