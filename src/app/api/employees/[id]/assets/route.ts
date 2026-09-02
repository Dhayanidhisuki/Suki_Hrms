/**
 * GET  /api/employees/[id]/assets   — list asset allocations
 * POST /api/employees/[id]/assets   — allocate an asset
 *
 * A serial number, when provided, must not already be on another active
 * (unreturned) allocation — prevents the same physical unit being handed to
 * two employees at once.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { assetAllocationSchema } from '@/lib/validations/employee';
import { logActivity } from '@/lib/activity-log';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const data = await prisma.employeeAssetAllocation.findMany({
    where: { employeeId: parseInt(id) },
    include: { assetMaster: { select: { name: true } } },
    orderBy: { allocatedDate: 'desc' },
  });
  return NextResponse.json({
    data: data.map((row) => ({ ...row, assetTypeName: row.assetMaster.name })),
  });
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

  const parsed = assetAllocationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.serialNumber) {
    const clash = await prisma.employeeAssetAllocation.findFirst({
      where: { serialNumber: parsed.data.serialNumber, returnedDate: null },
    });
    if (clash) {
      return NextResponse.json(
        { error: `Serial number "${parsed.data.serialNumber}" is already on an active allocation` },
        { status: 409 }
      );
    }
  }

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.employeeAssetAllocation.create({ data: { employeeId, ...parsed.data } });
    await logActivity(tx, {
      employeeId,
      activityType: 'asset_allocated',
      module: 'assets',
      performedByUserId,
      newValue: { assetMasterId: parsed.data.assetMasterId, serialNumber: parsed.data.serialNumber },
      relatedRecordId: created.id,
    });
    return created;
  });

  return NextResponse.json(record, { status: 201 });
}
