import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { performanceCycleSchema } from '@/lib/validations/performance';

/** BRD §7 — performance cycles. Goal sets hang off these and inherit their date bounds. */
export async function GET(request: NextRequest) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;

    const status = request.nextUrl.searchParams.get('status');
    const data = await prisma.performanceCycle.findMany({
      where: { companyId: scope.companyId, ...(status ? { status } : {}) },
      include: { _count: { select: { goalSets: true } } },
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json({
      data,
      pagination: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
    });
  } catch (err) {
    console.error('[performance-cycles] GET failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load cycles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;

    const parsed = performanceCycleSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const duplicate = await prisma.performanceCycle.findFirst({
      where: { companyId: scope.companyId, code: parsed.data.code },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: 'A cycle with this code already exists' }, { status: 409 });

    const row = await prisma.performanceCycle.create({ data: { companyId: scope.companyId, ...parsed.data } });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('[performance-cycles] POST failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create cycle' }, { status: 500 });
  }
}
