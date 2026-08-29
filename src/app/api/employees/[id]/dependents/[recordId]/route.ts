/**
 * PUT    /api/employees/[id]/dependents/[recordId]   — update
 * DELETE /api/employees/[id]/dependents/[recordId]   — delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { dependentSchema } from '@/lib/validations/employee';
import { logActivity } from '@/lib/activity-log';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id, recordId } = await params;
  const employeeId = parseInt(id);
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const existing = await prisma.employeeDependent.findFirst({ where: { id: parseInt(recordId), employeeId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = dependentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.$transaction(async (tx) => {
    const updated = await tx.employeeDependent.update({ where: { id: existing.id }, data: parsed.data });
    await logActivity(tx, {
      employeeId,
      activityType: 'dependent_updated',
      module: 'dependents',
      performedByUserId,
      oldValue: { name: existing.name },
      newValue: { name: parsed.data.name },
      relatedRecordId: existing.id,
    });
    return updated;
  });

  return NextResponse.json(record);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id, recordId } = await params;
  const employeeId = parseInt(id);
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const existing = await prisma.employeeDependent.findFirst({ where: { id: parseInt(recordId), employeeId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.employeeDependent.delete({ where: { id: existing.id } });
    await logActivity(tx, {
      employeeId,
      activityType: 'dependent_deleted',
      module: 'dependents',
      performedByUserId,
      oldValue: { name: existing.name },
      relatedRecordId: existing.id,
    });
  });

  return NextResponse.json({ message: 'Deleted' });
}
