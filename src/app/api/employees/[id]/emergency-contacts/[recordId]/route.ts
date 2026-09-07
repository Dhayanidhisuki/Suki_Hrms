/**
 * PUT    /api/employees/[id]/emergency-contacts/[recordId]   — update
 * DELETE /api/employees/[id]/emergency-contacts/[recordId]   — delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { emergencyContactSchema } from '@/lib/validations/employee';
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

  const existing = await prisma.employeeEmergencyContact.findFirst({ where: { id: parseInt(recordId), employeeId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = emergencyContactSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.$transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      await tx.employeeEmergencyContact.updateMany({
        where: { employeeId, NOT: { id: existing.id } },
        data: { isPrimary: false },
      });
    }
    const updated = await tx.employeeEmergencyContact.update({ where: { id: existing.id }, data: parsed.data });
    await logActivity(tx, {
      employeeId,
      activityType: 'emergency_contact_updated',
      module: 'emergency_contacts',
      performedByUserId,
      oldValue: { contactName: existing.contactName },
      newValue: { contactName: parsed.data.contactName, isPrimary: parsed.data.isPrimary },
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

  const existing = await prisma.employeeEmergencyContact.findFirst({ where: { id: parseInt(recordId), employeeId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.employeeEmergencyContact.delete({ where: { id: existing.id } });
    await logActivity(tx, {
      employeeId,
      activityType: 'emergency_contact_deleted',
      module: 'emergency_contacts',
      performedByUserId,
      oldValue: { contactName: existing.contactName },
      relatedRecordId: existing.id,
    });
  });

  return NextResponse.json({ message: 'Deleted' });
}
