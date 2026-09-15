/**
 * GET /api/workforce/shift-change-request
 *   — lists shift change requests.
 *   ?scope=my (employee's own requests) | pending (requests pending my approval) | all (HR view)
 * POST /api/workforce/shift-change-request
 *   — employee creates a shift change request.
 *   Body: { requestedDate, requestedShiftMasterId, reason? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { resolveEmployeeShiftConfig, resolveDailyShift } from '@/lib/biometricConversion';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD expected');

const createSchema = z.object({
  requestedDate: isoDate,
  requestedShiftMasterId: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const scopeParam = request.nextUrl.searchParams.get('scope') ?? 'my';

  if (scopeParam === 'my') {
    // Employee's own requests
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    if (!ownEmployeeId) {
      return NextResponse.json({ data: [] });
    }
    const data = await prisma.shiftChangeRequest.findMany({
      where: { employeeId: ownEmployeeId },
      include: {
        employee: { select: { employeeCode: true, firstName: true, lastName: true } },
        currentShiftMaster: { select: { code: true, name: true } },
        requestedShiftMaster: { select: { code: true, name: true, startTime: true, endTime: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ data });
  }

  if (scopeParam === 'pending') {
    // Requests pending this user's approval
    const ownEmployeeId = await resolveOwnEmployeeId(userId);
    const data = await prisma.shiftChangeRequest.findMany({
      where: { status: 'pending', employee: { companyId: scope.companyId } },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, reportingManagerId: true } },
        currentShiftMaster: { select: { code: true, name: true } },
        requestedShiftMaster: { select: { code: true, name: true, startTime: true, endTime: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter to only requests this user can approve at the current stage
    const chainConfigs = await prisma.approvalChainConfig.findMany({
      where: { companyId: scope.companyId, module: 'SHIFT_CHANGE', isActive: true },
      orderBy: { stageOrder: 'asc' },
    });

    const filtered = data.filter((req) => {
      const stage = chainConfigs.find((c) => c.stageOrder === req.currentStageOrder);
      if (!stage) return false;
      if (stage.approverType === 'REPORTING_MANAGER') {
        return req.employee.reportingManagerId === ownEmployeeId;
      }
      if (stage.approverType === 'HR') {
        return true; // HR permission check is done by the API permission
      }
      if (stage.approverType === 'SPECIFIC_USER') {
        return stage.approverUserId === userId;
      }
      return false;
    });

    return NextResponse.json({ data: filtered });
  }

  if (scopeParam === 'all') {
    const permErr = await checkSpecificPermission(request, 'workforce.attendance.view');
    if (permErr) return permErr;
    const data = await prisma.shiftChangeRequest.findMany({
      where: { employee: { companyId: scope.companyId } },
      include: {
        employee: { select: { employeeCode: true, firstName: true, lastName: true } },
        currentShiftMaster: { select: { code: true, name: true } },
        requestedShiftMaster: { select: { code: true, name: true, startTime: true, endTime: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: 'scope must be one of: my, pending, all' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const requestedDate = new Date(parsed.data.requestedDate);

  // Get the current shift for this employee on this date
  const config = await resolveEmployeeShiftConfig(ownEmployeeId);
  const dailyShift = resolveDailyShift(config, requestedDate);

  // Check if there's already a pending request for this date
  const existing = await prisma.shiftChangeRequest.findFirst({
    where: { employeeId: ownEmployeeId, requestedDate, status: 'pending' },
  });
  if (existing) {
    return NextResponse.json({ error: 'A pending shift change request already exists for this date' }, { status: 409 });
  }

  const created = await prisma.shiftChangeRequest.create({
    data: {
      employeeId: ownEmployeeId,
      requestedDate,
      currentShiftMasterId: dailyShift.shiftMasterId,
      requestedShiftMasterId: parsed.data.requestedShiftMasterId,
      reason: parsed.data.reason ?? null,
      createdByUserId: userId,
    },
  });

  return NextResponse.json(created);
}
