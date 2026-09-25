/**
 * GET /api/workforce/shift-plan
 *   — returns the shift plan for employees in a date range.
 *   ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&employeeId=X (optional)
 *   For each employee/date, returns:
 *     - the resolved shift (from override or rotation plan)
 *     - whether it's an override or automatic
 *     - the shift details (code, name, start/end time, grace, night)
 *
 * POST /api/workforce/shift-plan
 *   — bulk upload shift overrides. Body: { overrides: [{employeeId, date, shiftMasterId, reason?}] }
 *   Creates or updates ShiftAssignmentOverride rows.
 *
 * DELETE /api/workforce/shift-plan
 *   — remove an override. Body: { employeeId, date }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveEmployeeShiftConfig, resolveDailyShift } from '@/lib/biometricConversion';
import { getAttendanceLock, checkMonthNotFrozen } from '@/lib/attendanceFreeze';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD expected');

function parseUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const sp = request.nextUrl.searchParams;
  const startDateStr = sp.get('startDate');
  const endDateStr = sp.get('endDate');
  const employeeIdStr = sp.get('employeeId');

  if (!startDateStr || !endDateStr) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  const startDate = parseUtc(startDateStr);
  const endDate = parseUtc(endDateStr);
  if (endDate < startDate) {
    return NextResponse.json({ error: 'endDate must be after startDate' }, { status: 400 });
  }

  const employeeFilter: Record<string, unknown> = { companyId: scope.companyId, deletedAt: null, isActive: true };
  if (employeeIdStr) {
    employeeFilter.id = Number(employeeIdStr);
  }

  const employees = await prisma.employee.findMany({
    where: employeeFilter as Record<string, unknown>,
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: { shiftAssignmentType: true, shiftMasterId: true, shiftRotationPlanId: true },
      },
    },
    orderBy: { employeeCode: 'asc' },
  });

  // Load all overrides in the date range for these employees.
  const empIds = employees.map((e) => e.id);
  const overrides = await prisma.shiftAssignmentOverride.findMany({
    where: {
      employeeId: { in: empIds },
      date: { gte: startDate, lte: endDate },
    },
    include: { shiftMaster: { select: { id: true, code: true, name: true, startTime: true, endTime: true, graceMinutes: true, nightAllowed: true } } },
  });

  // Build override map: employeeId -> date -> override
  const overrideMap = new Map<number, Map<string, typeof overrides[number]>>();
  for (const ov of overrides) {
    if (!overrideMap.has(ov.employeeId)) overrideMap.set(ov.employeeId, new Map());
    overrideMap.get(ov.employeeId)!.set(ov.date.toISOString().slice(0, 10), ov);
  }

  // Load all shift masters for this company for lookup.
  const shiftMasters = await prisma.shiftMaster.findMany({
    where: { deletedAt: null, isActive: true },
    select: { id: true, code: true, name: true, startTime: true, endTime: true, graceMinutes: true, nightAllowed: true },
  });
  const shiftMap = new Map(shiftMasters.map((s) => [s.id, s]));

  const plan: Array<{
    employeeId: number;
    employeeCode: string;
    employeeName: string;
    date: string;
    shiftMasterId: number | null;
    shiftCode: string | null;
    shiftName: string | null;
    startTime: string | null;
    endTime: string | null;
    graceMinutes: number;
    nightAllowed: boolean;
    isOverride: boolean;
    overrideReason: string | null;
  }> = [];

  for (const emp of employees) {
    const config = await resolveEmployeeShiftConfig(emp.id);
    const empOverrides = overrideMap.get(emp.id) ?? new Map();

    // Iterate each day in the range
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const override = empOverrides.get(dateStr);

      let shiftMasterId: number | null;
      let isOverride = false;
      let overrideReason: string | null = null;

      if (override) {
        shiftMasterId = override.shiftMaster.id;
        isOverride = true;
        overrideReason = override.reason;
      } else {
        const dailyShift = resolveDailyShift(config, cursor);
        shiftMasterId = dailyShift.shiftMasterId;
      }

      const sm = shiftMasterId ? shiftMap.get(shiftMasterId) : null;

      plan.push({
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        date: dateStr,
        shiftMasterId,
        shiftCode: sm?.code ?? null,
        shiftName: sm?.name ?? null,
        startTime: sm?.startTime ?? null,
        endTime: sm?.endTime ?? null,
        graceMinutes: sm?.graceMinutes ?? 0,
        nightAllowed: sm?.nightAllowed ?? false,
        isOverride,
        overrideReason,
      });

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return NextResponse.json({ data: plan });
}

const overrideSchema = z.object({
  overrides: z.array(z.object({
    employeeId: z.number().int().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    shiftMasterId: z.number().int().positive(),
    reason: z.string().max(500).optional(),
  })).min(1),
});

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const userId = Number(request.headers.get('x-user-id'));
  const parsed = overrideSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  const locked: { employeeId: number; date: string; error: string }[] = [];
  for (const ov of parsed.data.overrides) {
    const date = parseUtc(ov.date);
    const lock = await getAttendanceLock(ov.employeeId, date);
    if (lock) {
      locked.push({ employeeId: ov.employeeId, date: ov.date, error: lock.message });
      continue;
    }
    const existing = await prisma.shiftAssignmentOverride.findUnique({
      where: { employeeId_date: { employeeId: ov.employeeId, date } },
    });
    if (existing) {
      await prisma.shiftAssignmentOverride.update({
        where: { id: existing.id },
        data: { shiftMasterId: ov.shiftMasterId, reason: ov.reason ?? null, createdByUserId: userId },
      });
      updated++;
    } else {
      await prisma.shiftAssignmentOverride.create({
        data: { employeeId: ov.employeeId, date, shiftMasterId: ov.shiftMasterId, reason: ov.reason ?? null, createdByUserId: userId },
      });
      created++;
    }
  }

  return NextResponse.json({ created, updated, skippedLocked: locked.length, locked, total: parsed.data.overrides.length });
}

export async function DELETE(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.edit');
  if (permErr) return permErr;

  const body = await request.json().catch(() => null);
  const employeeId = Number(body?.employeeId);
  const dateStr = body?.date as string;
  if (!employeeId || !dateStr) {
    return NextResponse.json({ error: 'employeeId and date are required' }, { status: 400 });
  }

  const date = parseUtc(dateStr);
  const freezeErr = await checkMonthNotFrozen(employeeId, date);
  if (freezeErr) return freezeErr;
  const deleted = await prisma.shiftAssignmentOverride.deleteMany({
    where: { employeeId, date },
  });

  return NextResponse.json({ deleted: deleted.count });
}
