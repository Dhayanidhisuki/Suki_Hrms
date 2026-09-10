/**
 * POST /api/employees/[id]/confirmation/manager-recommend
 * Body: { recommendation: 'recommend' | 'extend' | 'reject', remarks? }
 *
 * Manager recommendation stage for probation confirmation (two-level
 * approval: Manager → HR). The employee's own Reporting Manager (Level 1
 * or Level 2) submits their recommendation. HR then acts on it via the
 * existing /approve, /extend, or /reject routes.
 *
 * Stores the recommendation on the current JobInfo. Does NOT confirm,
 * extend, or reject — that remains HR's action.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity-log';
import { resolveOwnEmployeeId, isManagerOfAnyLevel } from '@/lib/reportingManager';
import { z } from 'zod';

const recommendSchema = z.object({
  recommendation: z.enum(['recommend', 'extend', 'reject']),
  remarks: z.string().max(500).optional().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const employeeId = parseInt(id);
  const userId = Number(request.headers.get('x-user-id')) || null;

  // Hierarchy check: only the employee's own Reporting Manager may recommend
  const ownEmployeeId = await resolveOwnEmployeeId(userId ?? 0);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }
  if (!(await isManagerOfAnyLevel(ownEmployeeId, employeeId))) {
    return NextResponse.json(
      { error: "Forbidden — only the employee's Reporting Manager can submit a recommendation" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = recommendSchema.safeParse(body);
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
  if (currentJob.managerRecommendation) {
    return NextResponse.json({ error: 'Manager recommendation already submitted' }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.jobInfo.update({
      where: { id: currentJob.id },
      data: {
        managerRecommendation: parsed.data.recommendation,
        managerRecommendationByUserId: userId,
        managerRecommendationAt: new Date(),
        managerRemarks: parsed.data.remarks ?? null,
      },
    });

    await logActivity(tx, {
      employeeId,
      activityType: 'manager_recommendation',
      module: 'confirmation',
      performedByUserId: userId,
      newValue: { recommendation: parsed.data.recommendation },
      remarks: parsed.data.remarks ?? `Manager recommended: ${parsed.data.recommendation}`,
    });
  });

  return NextResponse.json({
    message: 'Manager recommendation submitted',
    recommendation: parsed.data.recommendation,
  });
}
