/**
 * POST /api/employees/[id]/confirmation/reject
 * Marks the employee as resigned, per client decision (reject = "not
 * confirming this employment" rather than a generic termination).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { logActivity } from '@/lib/activity-log';
import { z } from 'zod';

const rejectSchema = z.object({
  remarks: z.string().max(500).optional().nullable(),
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
  const parsed = rejectSchema.safeParse(body);
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
  if (employee.jobInfos[0]?.confirmationDate) {
    return NextResponse.json({ error: 'Employee is already confirmed' }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employeeId },
      data: { status: 'resigned' },
    });

    await logActivity(tx, {
      employeeId,
      activityType: 'confirmation_rejected',
      module: 'confirmation',
      performedByUserId,
      oldValue: { status: employee.status },
      newValue: { status: 'resigned' },
      remarks: parsed.data.remarks ?? 'Confirmation rejected — marked resigned',
    });
  });

  return NextResponse.json({ message: 'Employee marked resigned' });
}
