/**
 * GET / PUT / DELETE (soft) /api/masters/business-units/[id] — company-scoped.
 * Deactivation is blocked while a Unit still sits under the business unit
 * (BRD 01 §5.2 "blocked while any employee holds it" — held via Unit).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { businessUnitSchema } from '@/lib/validations/employee-master';
import { audit } from '@/lib/platform/audit/service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const permErr = await checkSpecificPermission(request, 'masters.org.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const record = await prisma.businessUnit.findFirst({ where: { id: parseInt(id), companyId: scope.companyId, deletedAt: null } });
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

  const existing = await prisma.businessUnit.findFirst({ where: { id: recordId, companyId: scope.companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = businessUnitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.code !== existing.code) {
    const dup = await prisma.businessUnit.findUnique({ where: { companyId_code: { companyId: scope.companyId, code: data.code } } });
    if (dup) return NextResponse.json({ error: 'Business unit code already exists in this company' }, { status: 409 });
  }
  if (data.headEmpId) {
    const head = await prisma.employee.findFirst({ where: { id: data.headEmpId, companyId: scope.companyId, deletedAt: null, isActive: true }, select: { id: true } });
    if (!head) return NextResponse.json({ error: 'Head employee must be an active employee of this company' }, { status: 400 });
  }
  if (!data.isActive && existing.isActive) {
    const held = await prisma.unit.count({ where: { businessUnitId: recordId, deletedAt: null } });
    if (held > 0) return NextResponse.json({ error: `Cannot deactivate: ${held} unit(s) still belong to this business unit` }, { status: 409 });
  }

  const record = await prisma.businessUnit.update({
    where: { id: recordId },
    data: { code: data.code, name: data.name, headEmpId: data.headEmpId ?? null, description: data.description ?? null, isActive: data.isActive },
  });
  await audit({
    companyId: scope.companyId,
    entityType: 'BusinessUnit',
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

  const existing = await prisma.businessUnit.findFirst({ where: { id: recordId, companyId: scope.companyId, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const held = await prisma.unit.count({ where: { businessUnitId: recordId, deletedAt: null } });
  if (held > 0) return NextResponse.json({ error: `Cannot delete: ${held} unit(s) still belong to this business unit` }, { status: 409 });

  await prisma.businessUnit.update({ where: { id: recordId }, data: { deletedAt: new Date(), isActive: false } });
  await audit({
    companyId: scope.companyId,
    entityType: 'BusinessUnit',
    entityId: recordId,
    entityRef: existing.code,
    action: 'SOFT_DELETE',
    actor: { userId: Number(request.headers.get('x-user-id')) || null },
    before: existing,
  });
  return NextResponse.json({ message: 'Soft-deleted' });
}
