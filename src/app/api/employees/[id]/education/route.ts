/**
 * GET  /api/employees/[id]/education   — list education records
 * POST /api/employees/[id]/education   — add an education record
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { educationSchema } from '@/lib/validations/employee';
import { logActivity } from '@/lib/activity-log';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const data = await prisma.employeeEducation.findMany({
    where: { employeeId: parseInt(id) },
    orderBy: { yearOfPassing: 'desc' },
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

  const parsed = educationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.employeeEducation.create({ data: { employeeId, ...parsed.data } });
    await logActivity(tx, {
      employeeId,
      activityType: 'education_added',
      module: 'education',
      performedByUserId,
      newValue: { qualification: parsed.data.qualification },
      relatedRecordId: created.id,
    });
    return created;
  });

  return NextResponse.json(record, { status: 201 });
}
