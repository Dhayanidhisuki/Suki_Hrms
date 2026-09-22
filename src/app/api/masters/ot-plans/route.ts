import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { otPlanSchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';
  // 'active' | 'inactive'; anything else (including absent) means no filter,
  // so an existing caller that never sends it keeps seeing every row.
  const status = searchParams.get('status');

  const where = {
    deletedAt: null,
    ...(status === 'active' ? { isActive: true } : status === 'inactive' ? { isActive: false } : {}),
    ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.oTPlan.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { payComponent: { select: { id: true, name: true } } },
    }),
    prisma.oTPlan.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const body = await request.json();
  const parsed = otPlanSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.oTPlan.findUnique({ where: { code: parsed.data.code } });
  if (existing && existing.deletedAt === null) return NextResponse.json({ error: 'Code already exists' }, { status: 409 });

  // OTPlan is a global master (no companyId) but its Pay Component is a
  // company-scoped SalaryComponent — confirm it belongs to the caller's
  // own company before linking, since nothing at the DB level enforces that.
  if (parsed.data.payComponentId) {
    const owned = await prisma.salaryComponent.findFirst({
      where: { id: parsed.data.payComponentId, companyId: scope.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: 'Pay Component not found in this company' }, { status: 400 });
  }

  const record = await prisma.oTPlan.create({ data: parsed.data, include: { payComponent: { select: { id: true, name: true } } } });
  return NextResponse.json(record, { status: 201 });
}
