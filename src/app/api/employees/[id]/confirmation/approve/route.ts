/**
 * POST /api/employees/[id]/confirmation/approve
 * Sets the current JobInfo's confirmationDate (today, or an admin-supplied
 * date) and logs an EmployeeActivity entry. This is the ONLY place
 * confirmationDate is ever written.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { logActivity } from '@/lib/activity-log';
import { z } from 'zod';

const approveSchema = z.object({
  confirmationDate: z.coerce.date().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'employee.edit');
  if (permErr) return permErr;

  const { id } = await params;
  const employeeId = parseInt(id);
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const body = await request.json().catch(() => ({}));
  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    include: { jobInfos: { where: { effectiveTo: null }, take: 1 } },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }
  const currentJob = employee.jobInfos[0];
  if (!currentJob) {
    return NextResponse.json({ error: 'Employee has no current job record' }, { status: 400 });
  }
  if (currentJob.confirmationDate) {
    return NextResponse.json({ error: 'Employee is already confirmed' }, { status: 409 });
  }

  const confirmationDate = parsed.data.confirmationDate ?? new Date();

  await prisma.$transaction(async (tx) => {
    await tx.jobInfo.update({
      where: { id: currentJob.id },
      data: { confirmationDate },
    });

    await logActivity(tx, {
      employeeId,
      activityType: 'confirmed',
      module: 'confirmation',
      performedByUserId,
      oldValue: { confirmationDate: null },
      newValue: { confirmationDate },
      remarks: 'Probation confirmed by admin',
    });
  });

  return NextResponse.json({ message: 'Employee confirmed', confirmationDate });
}
