/**
 * GET /api/payroll/fnf?status=X
 * POST /api/payroll/fnf  { employeeId | employeeCode, exitInterviewId? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { logActivity } from '@/lib/activity-log';
import { fnfInclude } from '@/lib/fnf/include';
import { queueStatuses } from '@/lib/fnf/workflow';

const createSchema = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
  employeeCode: z.string().min(1).max(40).optional(),
  exitInterviewId: z.coerce.number().int().positive().optional(),
}).refine((d) => d.employeeId || d.employeeCode, { message: 'employeeId or employeeCode is required' });

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const queue = searchParams.get('queue');
  const q = searchParams.get('q')?.trim();

  const where: Record<string, unknown> = { companyId: scope.companyId };
  const queued = queue ? queueStatuses(queue) : null;
  if (queued) where.status = { in: queued };
  else if (status) where.status = status;
  if (q) {
    where.employee = {
      companyId: scope.companyId,
      OR: [
        { employeeCode: { contains: q } },
        { firstName: { contains: q } },
        { lastName: { contains: q } },
      ],
    };
  }

  try {
    const data = await prisma.fnFSettlement.findMany({
      where,
      include: fnfInclude,
      orderBy: [{ createdAt: 'desc' }],
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[GET /api/payroll/fnf]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load settlements' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.manage');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const employee = parsed.data.employeeId
    ? await prisma.employee.findFirst({
        where: { id: parsed.data.employeeId, companyId: scope.companyId, deletedAt: null },
      })
    : await prisma.employee.findFirst({
        where: { employeeCode: parsed.data.employeeCode, companyId: scope.companyId, deletedAt: null },
      });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const exitInterview = parsed.data.exitInterviewId
    ? await prisma.exitInterview.findUnique({ where: { id: parsed.data.exitInterviewId } })
    : await prisma.exitInterview.findUnique({ where: { employeeId: employee.id } });
  if (!exitInterview || exitInterview.employeeId !== employee.id) {
    return NextResponse.json({ error: 'A valid recorded separation is required before F&F' }, { status: 404 });
  }

  const existing = await prisma.fnFSettlement.findUnique({
    where: { exitInterviewId: exitInterview.id },
  });
  if (existing) {
    return NextResponse.json({ error: 'An F&F settlement already exists for this separation' }, { status: 409 });
  }

  const userId = Number(request.headers.get('x-user-id')) || null;
  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.fnFSettlement.create({
      data: {
        companyId: scope.companyId,
        employeeId: employee.id,
        exitInterviewId: exitInterview.id,
        lastWorkingDay: exitInterview.approvedLastWorkingDay ?? exitInterview.exitDate,
        noticeServedDays: exitInterview.noticeServedDays ?? 0,
        noticeWaivedDays: exitInterview.noticeWaivedDays ?? 0,
        status: 'pending',
      },
      include: fnfInclude,
    });
    await logActivity(tx, {
      employeeId: employee.id,
      activityType: 'fnf_created',
      module: 'fnf',
      performedByUserId: userId,
      relatedRecordId: created.id,
      newValue: { status: 'pending', exitInterviewId: exitInterview.id },
    });
    return created;
  });

  return NextResponse.json(record, { status: 201 });
}
