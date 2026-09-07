/**
 * GET  /api/workforce/leave/applications?status=&employeeId=
 * POST /api/workforce/leave/applications
 *
 * Apply for leave. Checks LeaveBalance if one exists for the employee/leave
 * type/year (numberOfDays must not exceed closingBalance); if no balance row
 * exists yet, the application is allowed through — Phase 1 has no automated
 * accrual job, so balances are seeded/maintained separately, and blocking
 * every application on a missing balance row would make the feature unusable
 * before that exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { leaveApplicationSchema } from '@/lib/validations/workforce';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.leave.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const employeeIdParam = searchParams.get('employeeId');

  const records = await prisma.leaveApplication.findMany({
    where: {
      employee: { companyId: scope.companyId, deletedAt: null },
      ...(status ? { status } : {}),
      ...(employeeIdParam ? { employeeId: Number(employeeIdParam) } : {}),
    },
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      leaveMaster: { select: { id: true, code: true, name: true } },
    },
    orderBy: { appliedAt: 'desc' },
  });

  return NextResponse.json({ data: records });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.leave.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = leaveApplicationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { employeeId, leaveMasterId, fromDate, toDate, numberOfDays, isHalfDay, reason } = parsed.data;

  if (toDate < fromDate) {
    return NextResponse.json({ error: 'toDate cannot be before fromDate' }, { status: 400 });
  }

  const employee = await findEmployeeInCompany(employeeId, scope.companyId);
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const leaveMaster = await prisma.leaveMaster.findFirst({
    where: { id: leaveMasterId, isActive: true, deletedAt: null },
  });
  if (!leaveMaster) {
    return NextResponse.json({ error: 'Invalid or inactive leave type' }, { status: 400 });
  }

  const year = fromDate.getUTCFullYear();
  const balance = await prisma.leaveBalance.findUnique({
    where: { employeeId_leaveMasterId_year: { employeeId, leaveMasterId, year } },
  });
  if (balance && Number(balance.closingBalance) < numberOfDays) {
    return NextResponse.json(
      { error: `Insufficient leave balance: ${balance.closingBalance} available, ${numberOfDays} requested` },
      { status: 400 }
    );
  }

  const record = await prisma.leaveApplication.create({
    data: { employeeId, leaveMasterId, fromDate, toDate, numberOfDays, isHalfDay, reason, status: 'pending' },
  });

  return NextResponse.json(record, { status: 201 });
}
