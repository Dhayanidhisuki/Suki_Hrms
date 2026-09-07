/**
 * GET  /api/employees/[id]/emergency-contacts   — list emergency contacts
 * POST /api/employees/[id]/emergency-contacts   — add one
 *
 * Only one contact may be isPrimary per employee — enforced here by
 * unsetting any other primary in the same transaction, rather than
 * rejecting the request (spec: "Allow only one primary emergency contact").
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { emergencyContactSchema } from '@/lib/validations/employee';
import { logActivity } from '@/lib/activity-log';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const data = await prisma.employeeEmergencyContact.findMany({
    where: { employeeId: parseInt(id) },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });
  return NextResponse.json({ data });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const employeeId = parseInt(id);
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const employee = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null }, select: { id: true } });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const parsed = emergencyContactSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.$transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      await tx.employeeEmergencyContact.updateMany({ where: { employeeId }, data: { isPrimary: false } });
    }
    const created = await tx.employeeEmergencyContact.create({ data: { employeeId, ...parsed.data } });
    await logActivity(tx, {
      employeeId,
      activityType: 'emergency_contact_added',
      module: 'emergency_contacts',
      performedByUserId,
      newValue: { contactName: parsed.data.contactName, isPrimary: parsed.data.isPrimary },
      relatedRecordId: created.id,
    });
    return created;
  });

  return NextResponse.json(record, { status: 201 });
}
