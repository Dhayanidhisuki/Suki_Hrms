/**
 * GET /api/employees/[id]/passport   — Passport tab
 * PUT /api/employees/[id]/passport   — atomic upsert, logs an EmployeeActivity entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { passportSchema } from '@/lib/validations/employee';
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
    select: { passport: true },
  });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  return NextResponse.json(employee.passport ?? {});
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

  const parsed = passportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const employee = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null }, select: { id: true } });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const record = await prisma.$transaction(async (tx) => {
    const saved = await tx.employeePassport.upsert({
      where: { employeeId },
      update: parsed.data,
      create: { employeeId, ...parsed.data },
    });
    await logActivity(tx, {
      employeeId,
      activityType: 'passport_updated',
      module: 'passport',
      performedByUserId,
      newValue: { passportNumber: parsed.data.passportNumber },
    });
    return saved;
  });

  return NextResponse.json(record);
}
