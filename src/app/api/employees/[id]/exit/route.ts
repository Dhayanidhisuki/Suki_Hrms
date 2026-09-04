/**
 * GET  /api/employees/[id]/exit — this employee's recorded separation, if any.
 * POST /api/employees/[id]/exit — record a separation (1:1, immutable —
 *      409 if one already exists, matching "prevent duplicate final
 *      settlement" BR intent). Also updates Employee.status to match
 *      exitType, reusing the existing active|on-leave|terminated|resigned
 *      convention rather than inventing a new status value.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { exitInterviewSchema } from '@/lib/validations/employee';
import { logActivity } from '@/lib/activity-log';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'employee.separation.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const employee = await findEmployeeInCompany(parseInt(id), scope.companyId);
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const record = await prisma.exitInterview.findUnique({ where: { employeeId: employee.id } });
  return NextResponse.json(record);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'employee.separation.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const employeeId = parseInt(id);
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const employee = await findEmployeeInCompany(employeeId, scope.companyId);
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const existing = await prisma.exitInterview.findUnique({ where: { employeeId } });
  if (existing) {
    return NextResponse.json({ error: 'A separation is already recorded for this employee.' }, { status: 409 });
  }

  const parsed = exitInterviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const employeeStatus = parsed.data.exitType === 'resignation' ? 'resigned' : 'terminated';

  const created = await prisma.$transaction(async (tx) => {
    const record = await tx.exitInterview.create({ data: { employeeId, ...parsed.data } });
    await tx.employee.update({ where: { id: employeeId }, data: { status: employeeStatus } });
    await logActivity(tx, {
      employeeId,
      activityType: 'separation_recorded',
      module: 'separation',
      performedByUserId,
      newValue: { exitDate: parsed.data.exitDate, exitType: parsed.data.exitType },
      relatedRecordId: record.id,
    });
    return record;
  });

  return NextResponse.json(created, { status: 201 });
}
