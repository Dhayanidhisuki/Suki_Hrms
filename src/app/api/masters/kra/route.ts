import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { kraSchema } from '@/lib/validations/performance';

/** BRD §8 — KRA master. */
export async function GET(request: NextRequest) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;

    const sp = request.nextUrl.searchParams;
    const search = sp.get('search')?.trim();
    const departmentId = sp.get('departmentId');
    const designationId = sp.get('designationId');
    const status = sp.get('status');

    const data = await prisma.kra.findMany({
      where: {
        companyId: scope.companyId,
        ...(status ? { status } : {}),
        ...(departmentId ? { departmentId: Number(departmentId) } : {}),
        ...(designationId ? { designationId: Number(designationId) } : {}),
        ...(search
          ? { OR: [{ code: { contains: search } }, { name: { contains: search } }, { category: { contains: search } }] }
          : {}),
      },
      include: { _count: { select: { kpis: true } } },
      orderBy: { code: 'asc' },
    });

    return NextResponse.json({
      data,
      pagination: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
    });
  } catch (err) {
    console.error('[kra] GET failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load KRAs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;

    const parsed = kraSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const duplicate = await prisma.kra.findFirst({
      where: { companyId: scope.companyId, code: parsed.data.code },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: 'A KRA with this code already exists' }, { status: 409 });

    const row = await prisma.kra.create({ data: { companyId: scope.companyId, ...parsed.data } });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('[kra] POST failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create KRA' }, { status: 500 });
  }
}
