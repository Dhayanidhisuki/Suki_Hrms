/**
 * GET  /api/employees/[id]/experience   — list experience records
 * POST /api/employees/[id]/experience   — add an experience record
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { experienceSchema } from '@/lib/validations/employee';
import { logActivity } from '@/lib/activity-log';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const data = await prisma.employeeExperience.findMany({
    where: { employeeId: parseInt(id) },
    orderBy: { fromDate: 'desc' },
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

  const parsed = experienceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.employeeExperience.create({ data: { employeeId, ...parsed.data } });
    await logActivity(tx, {
      employeeId,
      activityType: 'experience_added',
      module: 'experience',
      performedByUserId,
      newValue: { companyName: parsed.data.companyName },
      relatedRecordId: created.id,
    });
    return created;
  });

  return NextResponse.json(record, { status: 201 });
}
