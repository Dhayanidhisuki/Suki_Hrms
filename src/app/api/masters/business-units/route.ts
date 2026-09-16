/**
 * GET  /api/masters/business-units — list (search / pagination), company-scoped
 * POST /api/masters/business-units — create (BRD 01 §5.2: buCode is supplied,
 *      head employee code validated against an active employee)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { businessUnitSchema } from '@/lib/validations/employee-master';
import { audit } from '@/lib/platform/audit/service';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.org.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '20') || 20));
  const search = searchParams.get('search') ?? '';

  const where = {
    companyId: scope.companyId,
    deletedAt: null,
    ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.businessUnit.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { code: 'asc' } }),
    prisma.businessUnit.count({ where }),
  ]);

  const headIds = rows.map((r) => r.headEmpId).filter((v): v is number => v !== null);
  const heads = headIds.length
    ? await prisma.employee.findMany({ where: { id: { in: headIds } }, select: { id: true, employeeCode: true, firstName: true, lastName: true } })
    : [];
  const headById = new Map(heads.map((h) => [h.id, h]));

  return NextResponse.json({
    data: rows.map((r) => ({ ...r, head: r.headEmpId ? (headById.get(r.headEmpId) ?? null) : null })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.org.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = businessUnitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const dup = await prisma.businessUnit.findUnique({ where: { companyId_code: { companyId: scope.companyId, code: data.code } } });
  if (dup) return NextResponse.json({ error: 'Business unit code already exists in this company' }, { status: 409 });

  if (data.headEmpId) {
    const head = await prisma.employee.findFirst({ where: { id: data.headEmpId, companyId: scope.companyId, deletedAt: null, isActive: true }, select: { id: true } });
    if (!head) return NextResponse.json({ error: 'Head employee must be an active employee of this company' }, { status: 400 });
  }

  const record = await prisma.businessUnit.create({
    data: { companyId: scope.companyId, code: data.code, name: data.name, headEmpId: data.headEmpId ?? null, description: data.description ?? null, isActive: data.isActive },
  });
  await audit({
    companyId: scope.companyId,
    entityType: 'BusinessUnit',
    entityId: record.id,
    entityRef: record.code,
    action: 'CREATE',
    actor: { userId: Number(request.headers.get('x-user-id')) || null },
    after: record,
  });
  return NextResponse.json(record, { status: 201 });
}
