/**
 * GET  /api/employees/[id]/dependents   — list dependents
 * POST /api/employees/[id]/dependents   — add a dependent
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { dependentSchema } from '@/lib/validations/employee';
import { logActivity } from '@/lib/activity-log';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const data = await prisma.employeeDependent.findMany({
    where: { employeeId: parseInt(id) },
    orderBy: { createdAt: 'asc' },
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

  const parsed = dependentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.employeeDependent.create({ data: { employeeId, ...parsed.data } });
    await logActivity(tx, {
      employeeId,
      activityType: 'dependent_added',
      module: 'dependents',
      performedByUserId,
      newValue: { name: parsed.data.name },
      relatedRecordId: created.id,
    });
    return created;
  });

  return NextResponse.json(record, { status: 201 });
}
