/**
 * PUT    /api/employees/[id]/experience/[recordId]   — update
 * DELETE /api/employees/[id]/experience/[recordId]   — delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { experienceSchema } from '@/lib/validations/employee';
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

  const existing = await prisma.employeeExperience.findFirst({ where: { id: parseInt(recordId), employeeId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = experienceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.$transaction(async (tx) => {
    const updated = await tx.employeeExperience.update({ where: { id: existing.id }, data: parsed.data });
    await logActivity(tx, {
      employeeId,
      activityType: 'experience_updated',
      module: 'experience',
      performedByUserId,
      oldValue: { companyName: existing.companyName },
      newValue: { companyName: parsed.data.companyName },
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

  const existing = await prisma.employeeExperience.findFirst({ where: { id: parseInt(recordId), employeeId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.employeeExperience.delete({ where: { id: existing.id } });
    await logActivity(tx, {
      employeeId,
      activityType: 'experience_deleted',
      module: 'experience',
      performedByUserId,
      oldValue: { companyName: existing.companyName },
      relatedRecordId: existing.id,
    });
  });

  return NextResponse.json({ message: 'Deleted' });
}
