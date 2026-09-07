/**
 * GET /api/employees/[id]/personal   — Personal Details tab
 * PUT /api/employees/[id]/personal   — atomic upsert, logs an EmployeeActivity entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { personalDetailsSchema } from '@/lib/validations/employee';
import { logActivity } from '@/lib/activity-log';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;

  const { id } = await params;
  const employee = await prisma.employee.findFirst({
    where: { id: parseInt(id), deletedAt: null },
    select: { personalDetails: true },
  });

  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  return NextResponse.json(employee.personalDetails ?? {});
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;

  const { id } = await params;
  const employeeId = parseInt(id);
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const body = await request.json();
  const parsed = personalDetailsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const record = await prisma.$transaction(async (tx) => {
    const saved = await tx.personalDetails.upsert({
      where: { employeeId },
      update: parsed.data,
      create: { employeeId, ...parsed.data },
    });

    await logActivity(tx, {
      employeeId,
      activityType: 'personal_details_updated',
      module: 'personal',
      performedByUserId,
      newValue: { gender: parsed.data.gender, maritalStatus: parsed.data.maritalStatus },
    });

    return saved;
  });

  return NextResponse.json(record);
}
