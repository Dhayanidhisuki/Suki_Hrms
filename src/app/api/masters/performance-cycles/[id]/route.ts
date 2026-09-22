import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { performanceCycleSchema } from '@/lib/validations/performance';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const row = await prisma.performanceCycle.findFirst({
    where: { id: Number((await params).id), companyId: scope.companyId },
  });
  if (!row) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const id = Number((await params).id);

    const existing = await prisma.performanceCycle.findFirst({
      where: { id, companyId: scope.companyId },
      select: { id: true, status: true },
    });
    if (!existing) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });

    const parsed = performanceCycleSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    // BRD §7: "Closed cycles should become read-only." Reopening is an
    // explicit status change back to ACTIVE, not an incidental edit.
    if (existing.status === 'CLOSED' && parsed.data.status === 'CLOSED') {
      return NextResponse.json({ error: 'This cycle is closed and is read-only' }, { status: 409 });
    }

    const duplicate = await prisma.performanceCycle.findFirst({
      where: { companyId: scope.companyId, code: parsed.data.code, NOT: { id } },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: 'A cycle with this code already exists' }, { status: 409 });

    const row = await prisma.performanceCycle.update({ where: { id }, data: parsed.data });
    return NextResponse.json(row);
  } catch (err) {
    console.error('[performance-cycles] PUT failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update cycle' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const id = Number((await params).id);

    const row = await prisma.performanceCycle.findFirst({
      where: { id, companyId: scope.companyId },
      include: { _count: { select: { goalSets: true } } },
    });
    if (!row) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    if (row._count.goalSets) {
      return NextResponse.json(
        { error: 'This cycle has assigned goals and cannot be deleted. Close it instead.' },
        { status: 409 }
      );
    }

    await prisma.performanceCycle.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[performance-cycles] DELETE failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to delete cycle' }, { status: 500 });
  }
}
