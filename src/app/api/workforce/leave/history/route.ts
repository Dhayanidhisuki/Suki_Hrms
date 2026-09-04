/**
 * GET /api/workforce/leave/history?employeeId=&year=
 *
 * One employee's leave balances (per leave type, for the year) plus their
 * full application history — the BRD's "Leave History" screen (§12).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.leave.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const employeeId = Number(searchParams.get('employeeId'));
  const year = Number(searchParams.get('year')) || new Date().getFullYear();

  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
  }

  const employee = await findEmployeeInCompany(employeeId, scope.companyId);
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const [balances, applications] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { employeeId, year },
      include: { leaveMaster: { select: { id: true, code: true, name: true } } },
    }),
    prisma.leaveApplication.findMany({
      where: { employeeId, fromDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
      include: { leaveMaster: { select: { id: true, code: true, name: true } } },
      orderBy: { fromDate: 'desc' },
    }),
  ]);

  return NextResponse.json({ balances, applications });
}
