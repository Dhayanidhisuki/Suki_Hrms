/**
 * PUT    /api/employees/[id]/assets/[recordId]   — update (incl. setting
 *                                                    Actual Return Date)
 * DELETE /api/employees/[id]/assets/[recordId]   — remove a mistaken entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { assetAllocationSchema } from '@/lib/validations/employee';
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

  const existing = await prisma.employeeAssetAllocation.findFirst({ where: { id: parseInt(recordId), employeeId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = assetAllocationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.serialNumber && !parsed.data.returnedDate) {
    const clash = await prisma.employeeAssetAllocation.findFirst({
      where: { serialNumber: parsed.data.serialNumber, returnedDate: null, NOT: { id: existing.id } },
    });
    if (clash) {
      return NextResponse.json(
        { error: `Serial number "${parsed.data.serialNumber}" is already on an active allocation` },
        { status: 409 }
      );
    }
  }

  const record = await prisma.$transaction(async (tx) => {
    const updated = await tx.employeeAssetAllocation.update({ where: { id: existing.id }, data: parsed.data });
    await logActivity(tx, {
      employeeId,
      activityType: parsed.data.returnedDate ? 'asset_returned' : 'asset_updated',
      module: 'assets',
      performedByUserId,
      oldValue: { serialNumber: existing.serialNumber },
      newValue: { serialNumber: parsed.data.serialNumber, returnedDate: parsed.data.returnedDate },
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

  const existing = await prisma.employeeAssetAllocation.findFirst({ where: { id: parseInt(recordId), employeeId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.employeeAssetAllocation.delete({ where: { id: existing.id } });
    await logActivity(tx, {
      employeeId,
      activityType: 'asset_deleted',
      module: 'assets',
      performedByUserId,
      oldValue: { serialNumber: existing.serialNumber },
      relatedRecordId: existing.id,
    });
  });

  return NextResponse.json({ message: 'Deleted' });
}
