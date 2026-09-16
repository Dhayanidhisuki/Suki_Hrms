/**
 * GET / PUT / DELETE (soft) /api/masters/cost-centres/[id] — company-scoped.
 * Deactivation / deletion is blocked while any employee is booked to the
 * cost centre on a current or future-dated job row (BRD 01 §5.2).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { costCentreSchema } from '@/lib/validations/employee-master';
import { audit } from '@/lib/platform/audit/service';

type Ctx = { params: Promise<{ id: string }> };

async function heldByEmployees(costCentreId: number): Promise<number> {
  return prisma.jobInfo.count({
    where: { costCentreId, OR: [{ effectiveTo: null }, { effectiveFrom: { gt: new Date() } }], employee: { deletedAt: null } },
  });
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const permErr = await checkSpecificPermission(request, 'masters.org.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const record = await prisma.costCentre.findFirst({ where: { id: parseInt(id), companyId: scope.companyId, deletedAt: null } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const permErr = await checkSpecificPermission(request, 'masters.org.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const recordId = parseInt(id);

  const existing = await prisma.costCentre.findFirst({ where: { id: recordId, companyId: scope.companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = costCentreSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.code !== existing.code) {
    const dup = await prisma.costCentre.findUnique({ where: { companyId_code: { companyId: scope.companyId, code: data.code } } });
    if (dup) return NextResponse.json({ error: 'Cost centre code already exists in this company' }, { status: 409 });
  }
  if (data.departmentId) {
    const dept = await prisma.department.findFirst({ where: { id: data.departmentId, deletedAt: null }, select: { id: true } });
    if (!dept) return NextResponse.json({ error: 'Department not found' }, { status: 400 });
  }
  if (data.ownerEmpId) {
    const owner = await prisma.employee.findFirst({ where: { id: data.ownerEmpId, companyId: scope.companyId, deletedAt: null, isActive: true }, select: { id: true } });
    if (!owner) return NextResponse.json({ error: 'Budget owner must be an active employee of this company' }, { status: 400 });
  }
  if (!data.isActive && existing.isActive) {
    const held = await heldByEmployees(recordId);
    if (held > 0) return NextResponse.json({ error: `Cannot deactivate: ${held} employee job record(s) are booked to this cost centre` }, { status: 409 });
  }

  const record = await prisma.costCentre.update({
    where: { id: recordId },
    data: { code: data.code, name: data.name, departmentId: data.departmentId ?? null, ownerEmpId: data.ownerEmpId ?? null, description: data.description ?? null, isActive: data.isActive },
  });
  await audit({
    companyId: scope.companyId,
    entityType: 'CostCentre',
    entityId: record.id,
    entityRef: record.code,
    action: 'UPDATE',
    actor: { userId: Number(request.headers.get('x-user-id')) || null },
    before: existing,
    after: record,
  });
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const permErr = await checkSpecificPermission(request, 'masters.org.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const recordId = parseInt(id);

  const existing = await prisma.costCentre.findFirst({ where: { id: recordId, companyId: scope.companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const held = await heldByEmployees(recordId);
  if (held > 0) return NextResponse.json({ error: `Cannot delete: ${held} employee job record(s) are booked to this cost centre` }, { status: 409 });

  await prisma.costCentre.update({ where: { id: recordId }, data: { deletedAt: new Date(), isActive: false } });
  await audit({
    companyId: scope.companyId,
    entityType: 'CostCentre',
    entityId: recordId,
    entityRef: existing.code,
    action: 'SOFT_DELETE',
    actor: { userId: Number(request.headers.get('x-user-id')) || null },
    before: existing,
  });
  return NextResponse.json({ message: 'Soft-deleted' });
}
