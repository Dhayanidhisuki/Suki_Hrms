/**
 * GET /api/employees/[id]/contact   — Contact Details tab
 * PUT /api/employees/[id]/contact   — atomic upsert, logs an EmployeeActivity entry
 *
 * When sameAsPermanent is true, present-address fields are copied from the
 * permanent-address fields at save time (one-way sync — editing permanent
 * address later does not retroactively change a previously-copied present
 * address unless sameAsPermanent is saved again while true).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { contactDetailsSchema } from '@/lib/validations/employee';
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
    select: { contactDetails: true },
  });

  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  return NextResponse.json(employee.contactDetails ?? {});
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
  const parsed = contactDetailsSchema.safeParse(body);
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

  const data = { ...parsed.data };
  if (data.sameAsPermanent) {
    data.presentAddressLine1 = data.permanentAddressLine1;
    data.presentAddressLine2 = data.permanentAddressLine2;
    data.presentCity = data.permanentCity;
    data.presentState = data.permanentState;
    data.presentPincode = data.permanentPincode;
    data.presentMobile = data.permanentMobile;
  }

  const record = await prisma.$transaction(async (tx) => {
    const saved = await tx.employeeContactDetails.upsert({
      where: { employeeId },
      update: data,
      create: { employeeId, ...data },
    });

    await logActivity(tx, {
      employeeId,
      activityType: 'contact_details_updated',
      module: 'contact',
      performedByUserId,
      newValue: { permanentCity: data.permanentCity, sameAsPermanent: data.sameAsPermanent },
    });

    return saved;
  });

  return NextResponse.json(record);
}
