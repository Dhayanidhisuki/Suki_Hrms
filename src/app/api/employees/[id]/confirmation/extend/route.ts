/**
 * POST /api/employees/[id]/confirmation/extend
 * Sets a new (later) Probation End Date after reconsideration, per client
 * decision — the admin picks the new date directly rather than adding
 * months, so probationPeriodMonths is left as-is and may no longer exactly
 * match joinDate→probationEndDate after an extension (expected/documented).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { logActivity } from '@/lib/activity-log';
import { z } from 'zod';

const extendSchema = z.object({
  newProbationEndDate: z.coerce.date(),
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

  const body = await request.json();
  const parsed = extendSchema.safeParse(body);
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
  if (parsed.data.newProbationEndDate <= new Date()) {
    return NextResponse.json({ error: 'New probation end date must be in the future' }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.jobInfo.update({
      where: { id: currentJob.id },
      data: { probationEndDate: parsed.data.newProbationEndDate },
    });

    await logActivity(tx, {
      employeeId,
      activityType: 'probation_extended',
      module: 'confirmation',
      performedByUserId,
      oldValue: { probationEndDate: currentJob.probationEndDate },
      newValue: { probationEndDate: parsed.data.newProbationEndDate },
      remarks: parsed.data.remarks ?? 'Probation extended after reconsideration',
    });
  });

  return NextResponse.json({ message: 'Probation extended', probationEndDate: parsed.data.newProbationEndDate });
}
