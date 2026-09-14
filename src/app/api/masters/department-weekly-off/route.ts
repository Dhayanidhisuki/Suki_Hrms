/**
 * GET  /api/masters/department-weekly-off
 *   — list all department weekly off configs for this company.
 *   ?departmentId=X (optional filter)
 * POST /api/masters/department-weekly-off
 *   — set/toggle a weekly off day for a department.
 *   Body: { departmentId, weekOffDay, isFrozen? }
 * DELETE /api/masters/department-weekly-off
 *   — remove a weekly off day. Body: { id }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.definition.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const deptFilter = request.nextUrl.searchParams.get('departmentId');
  const where: Record<string, unknown> = { companyId: scope.companyId };
  if (deptFilter) where.departmentId = Number(deptFilter);

  const data = await prisma.departmentWeeklyOff.findMany({
    where,
    include: {
      department: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ departmentId: 'asc' }, { weekOffDay: 'asc' }],
  });

  return NextResponse.json({ data });
}

const createSchema = z.object({
  departmentId: z.number().int().positive(),
  weekOffDay: z.number().int().min(0).max(6),
  isFrozen: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.definition.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const userId = Number(request.headers.get('x-user-id'));
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Upsert: if [departmentId, weekOffDay] exists, update isFrozen; otherwise create.
  const existing = await prisma.departmentWeeklyOff.findUnique({
    where: {
      departmentId_weekOffDay: {
        departmentId: parsed.data.departmentId,
        weekOffDay: parsed.data.weekOffDay,
      },
    },
  });

  if (existing) {
    const updated = await prisma.departmentWeeklyOff.update({
      where: { id: existing.id },
      data: {
        isFrozen: parsed.data.isFrozen ?? !existing.isFrozen,
      },
      include: { department: { select: { id: true, code: true, name: true } } },
    });
    return NextResponse.json(updated);
  }

  const created = await prisma.departmentWeeklyOff.create({
    data: {
      companyId: scope.companyId,
      departmentId: parsed.data.departmentId,
      weekOffDay: parsed.data.weekOffDay,
      isFrozen: parsed.data.isFrozen ?? true,
      createdByUserId: userId,
    },
    include: { department: { select: { id: true, code: true, name: true } } },
  });
  return NextResponse.json(created);
}

export async function DELETE(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.definition.edit');
  if (permErr) return permErr;

  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  await prisma.departmentWeeklyOff.delete({ where: { id } });
  return NextResponse.json({ deleted: id });
}
