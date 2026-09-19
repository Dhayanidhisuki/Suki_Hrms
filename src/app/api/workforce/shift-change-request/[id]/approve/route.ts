/**
 * POST /api/workforce/shift-change-request/[id]/approve
 *   — approves the current stage of a shift change request.
 *   If there are more stages, advances to the next one.
 *   If this is the final stage, marks as approved and creates a
 *   ShiftAssignmentOverride for the requested date.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const reqId = Number(id);
  const req = await prisma.shiftChangeRequest.findUnique({
    where: { id: reqId },
    include: { employee: { select: { companyId: true, reportingManagerId: true } } },
  });
  if (!req) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (req.employee.companyId !== scope.companyId) {
    return NextResponse.json({ error: 'Not in your company' }, { status: 403 });
  }
  if (req.status !== 'pending') {
    return NextResponse.json({ error: `Request is already ${req.status}` }, { status: 409 });
  }

  // Load the approval chain for SHIFT_CHANGE
  const chainConfigs = await prisma.approvalChainConfig.findMany({
    where: { companyId: scope.companyId, module: 'SHIFT_CHANGE', isActive: true },
    orderBy: { stageOrder: 'asc' },
  });

  if (chainConfigs.length === 0) {
    // No chain configured — fall back to a single stage, but still gated:
    // the requester's own Reporting Manager, or an HR-level grant. Before
    // this guard existed the branch approved unconditionally, so in any
    // company that had not configured a SHIFT_CHANGE chain, any signed-in
    // user could approve any request — including their own.
    const fallbackApprover = await resolveOwnEmployeeId(userId);
    const isManager = fallbackApprover != null && req.employee.reportingManagerId === fallbackApprover;
    if (!isManager) {
      const permErr = await checkSpecificPermission(request, 'workforce.attendance.edit');
      if (permErr) return permErr;
    }

    await prisma.shiftChangeRequest.update({
      where: { id: reqId },
      data: {
        status: 'approved',
        approvedByUserId: userId,
        approvedAt: new Date(),
      },
    });
    // Create the override
    await prisma.shiftAssignmentOverride.upsert({
      where: { employeeId_date: { employeeId: req.employeeId, date: req.requestedDate } },
      update: { shiftMasterId: req.requestedShiftMasterId, reason: `Shift change request approved` },
      create: { employeeId: req.employeeId, date: req.requestedDate, shiftMasterId: req.requestedShiftMasterId, reason: `Shift change request approved`, createdByUserId: userId },
    });
    // Notify the employee
    await prisma.shiftChangeNotification.create({
      data: {
        employeeId: req.employeeId,
        date: req.requestedDate,
        oldShiftMasterId: req.currentShiftMasterId,
        newShiftMasterId: req.requestedShiftMasterId,
        reason: 'Shift change request approved',
        createdByUserId: userId,
      },
    });
    return NextResponse.json({ status: 'approved', message: 'Approved (no chain configured — single-stage default), override created' });
  }

  const currentStage = chainConfigs.find((c) => c.stageOrder === req.currentStageOrder);
  if (!currentStage) {
    return NextResponse.json({ error: 'Invalid approval stage' }, { status: 500 });
  }

  // Check if this user can approve this stage
  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (currentStage.approverType === 'REPORTING_MANAGER') {
    if (req.employee.reportingManagerId !== ownEmployeeId) {
      return NextResponse.json({ error: 'Only the reporting manager can approve this stage' }, { status: 403 });
    }
  } else if (currentStage.approverType === 'HR') {
    const permErr = await checkSpecificPermission(request, 'workforce.attendance.edit');
    if (permErr) return permErr;
  } else if (currentStage.approverType === 'SPECIFIC_USER') {
    if (currentStage.approverUserId !== userId) {
      return NextResponse.json({ error: 'You are not the designated approver for this stage' }, { status: 403 });
    }
  }

  // Check if there's a next stage
  const nextStage = chainConfigs.find((c) => c.stageOrder > req.currentStageOrder);
  if (nextStage) {
    // Advance to next stage
    const updated = await prisma.shiftChangeRequest.update({
      where: { id: reqId },
      data: { currentStageOrder: nextStage.stageOrder },
    });
    return NextResponse.json({ status: 'advanced', message: `Advanced to stage ${nextStage.stageOrder}: ${nextStage.stageName}`, data: updated });
  }

  // Final stage approved — mark as approved and create override
  await prisma.shiftChangeRequest.update({
    where: { id: reqId },
    data: {
      status: 'approved',
      approvedByUserId: userId,
      approvedAt: new Date(),
    },
  });
  await prisma.shiftAssignmentOverride.upsert({
    where: { employeeId_date: { employeeId: req.employeeId, date: req.requestedDate } },
    update: { shiftMasterId: req.requestedShiftMasterId, reason: `Shift change request approved` },
    create: { employeeId: req.employeeId, date: req.requestedDate, shiftMasterId: req.requestedShiftMasterId, reason: `Shift change request approved`, createdByUserId: userId },
  });
  // Notify the employee
  await prisma.shiftChangeNotification.create({
    data: {
      employeeId: req.employeeId,
      date: req.requestedDate,
      oldShiftMasterId: req.currentShiftMasterId,
      newShiftMasterId: req.requestedShiftMasterId,
      reason: 'Shift change request approved',
      createdByUserId: userId,
    },
  });

  return NextResponse.json({ status: 'approved', message: 'Request approved, shift override created' });
}
