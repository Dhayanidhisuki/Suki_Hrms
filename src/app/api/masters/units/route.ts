import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { unitSchema } from '@/lib/validations/master';
import { nextSequentialCode } from '@/lib/master-code';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';

  const where = {
    deletedAt: null,
    ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.unit.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { company: { select: { id: true, name: true } } },
    }),
    prisma.unit.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const body = await request.json();
  const parsed = unitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const company = await prisma.company.findFirst({ where: { id: parsed.data.companyId, deletedAt: null }, select: { code: true } });
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 400 });

  // Code is always server-generated, scoped to the company — "<CompanyCode>-001",
  // "-002"... Ignore whatever (if anything) the client sent. Scans all rows for
  // this company, deleted included, since (companyId, code) stays unique
  // even after a soft delete.
  const siblings = await prisma.unit.findMany({ where: { companyId: parsed.data.companyId }, select: { code: true } });
  const code = nextSequentialCode(siblings.map((s) => s.code), `${company.code}-`);

  const record = await prisma.unit.create({ data: { ...parsed.data, code } });
  return NextResponse.json(record, { status: 201 });
}
