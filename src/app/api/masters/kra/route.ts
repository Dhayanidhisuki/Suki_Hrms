import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildPagination, parsePageRequest } from '@/lib/pagination';
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
    // BRD §8 effective dating. Opt-in: the master list shows every KRA so HR
    // can still see and edit expired ones — callers that are *using* a KRA
    // (the template builder) pass the date they need it effective on.
    const effectiveOn = sp.get('effectiveOn');
    const effectiveAt = effectiveOn ? new Date(effectiveOn) : null;
    const effectiveFilter =
      effectiveAt && !Number.isNaN(effectiveAt.getTime())
        ? {
            effectiveFrom: { lte: effectiveAt },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveAt } }],
          }
        : {};

    const pageReq = parsePageRequest(sp);
    const where: Prisma.KraWhereInput = {
      companyId: scope.companyId,
      ...(status ? { status } : {}),
      ...(departmentId ? { departmentId: Number(departmentId) } : {}),
      ...(designationId ? { designationId: Number(designationId) } : {}),
      ...effectiveFilter,
      ...(search
        ? {
            AND: [
              { OR: [{ code: { contains: search } }, { name: { contains: search } }, { category: { contains: search } }] },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.kra.findMany({
        where,
        include: { _count: { select: { kpis: true } } },
        orderBy: { code: 'asc' },
        skip: pageReq.skip,
        take: pageReq.take,
      }),
      prisma.kra.count({ where }),
    ]);

    return NextResponse.json({ data, pagination: buildPagination(pageReq, total, data.length) });
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
