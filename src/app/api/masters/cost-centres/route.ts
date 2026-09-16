/**
 * GET  /api/masters/cost-centres — list (search / pagination / ?departmentId=), company-scoped
 * POST /api/masters/cost-centres — create (BRD 01 §5.2: ccCode is supplied by
 *      Finance; owning department and budget-owner employee are optional refs)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { costCentreSchema } from '@/lib/validations/employee-master';
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
  const departmentId = searchParams.get('departmentId');

  const where = {
    companyId: scope.companyId,
    deletedAt: null,
    ...(departmentId ? { departmentId: parseInt(departmentId) } : {}),
    ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.costCentre.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { code: 'asc' } }),
    prisma.costCentre.count({ where }),
  ]);

  const deptIds = [...new Set(rows.map((r) => r.departmentId).filter((v): v is number => v !== null))];
  const ownerIds = [...new Set(rows.map((r) => r.ownerEmpId).filter((v): v is number => v !== null))];
  const [departments, owners] = await Promise.all([
    deptIds.length ? prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, code: true, name: true } }) : [],
    ownerIds.length ? prisma.employee.findMany({ where: { id: { in: ownerIds } }, select: { id: true, employeeCode: true, firstName: true, lastName: true } }) : [],
  ]);
  const deptById = new Map(departments.map((d) => [d.id, d]));
  const ownerById = new Map(owners.map((o) => [o.id, o]));

  return NextResponse.json({
    data: rows.map((r) => ({
      ...r,
      department: r.departmentId ? (deptById.get(r.departmentId) ?? null) : null,
      owner: r.ownerEmpId ? (ownerById.get(r.ownerEmpId) ?? null) : null,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.org.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = costCentreSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const dup = await prisma.costCentre.findUnique({ where: { companyId_code: { companyId: scope.companyId, code: data.code } } });
  if (dup) return NextResponse.json({ error: 'Cost centre code already exists in this company' }, { status: 409 });

  if (data.departmentId) {
    const dept = await prisma.department.findFirst({ where: { id: data.departmentId, deletedAt: null }, select: { id: true } });
    if (!dept) return NextResponse.json({ error: 'Department not found' }, { status: 400 });
  }
  if (data.ownerEmpId) {
    const owner = await prisma.employee.findFirst({ where: { id: data.ownerEmpId, companyId: scope.companyId, deletedAt: null, isActive: true }, select: { id: true } });
    if (!owner) return NextResponse.json({ error: 'Budget owner must be an active employee of this company' }, { status: 400 });
  }

  const record = await prisma.costCentre.create({
    data: {
      companyId: scope.companyId,
      code: data.code,
      name: data.name,
      departmentId: data.departmentId ?? null,
      ownerEmpId: data.ownerEmpId ?? null,
      description: data.description ?? null,
      isActive: data.isActive,
    },
  });
  await audit({
    companyId: scope.companyId,
    entityType: 'CostCentre',
    entityId: record.id,
    entityRef: record.code,
    action: 'CREATE',
    actor: { userId: Number(request.headers.get('x-user-id')) || null },
    after: record,
  });
  return NextResponse.json(record, { status: 201 });
}
