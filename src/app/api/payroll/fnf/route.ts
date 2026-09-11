/**
 * GET /api/payroll/fnf?status=X
 *   List all FnF settlements for the company, optionally filtered by status.
 * POST /api/payroll/fnf
 *   Create a new FnF settlement for an employee (requires an exit interview).
 *   Body: { employeeId, exitInterviewId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

const createSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  exitInterviewId: z.coerce.number().int().positive(),
});

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const where: Record<string, unknown> = { companyId: scope.companyId };
  if (status) where.status = status;

  const data = await prisma.fnFSettlement.findMany({
    where,
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      exitInterview: { select: { id: true, exitDate: true, exitType: true, exitReason: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  return NextResponse.json({ data });
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

  // Validate employee and exit interview.
  const employee = await prisma.employee.findFirst({
    where: { id: parsed.data.employeeId, companyId: scope.companyId, deletedAt: null },
  });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const exitInterview = await prisma.exitInterview.findUnique({
    where: { id: parsed.data.exitInterviewId },
  });
  if (!exitInterview || exitInterview.employeeId !== parsed.data.employeeId) {
    return NextResponse.json({ error: 'Exit interview not found for this employee' }, { status: 404 });
  }

  // Check if FnF already exists for this exit interview.
  const existing = await prisma.fnFSettlement.findUnique({
    where: { exitInterviewId: parsed.data.exitInterviewId },
  });
  if (existing) {
    return NextResponse.json({ error: 'FnF settlement already exists for this exit' }, { status: 409 });
  }

  const record = await prisma.fnFSettlement.create({
    data: {
      companyId: scope.companyId,
      employeeId: parsed.data.employeeId,
      exitInterviewId: parsed.data.exitInterviewId,
      lastWorkingDay: exitInterview.exitDate,
      status: 'pending',
    },
    include: {
      employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      exitInterview: { select: { exitDate: true, exitType: true } },
    },
  });

  return NextResponse.json(record, { status: 201 });
}
