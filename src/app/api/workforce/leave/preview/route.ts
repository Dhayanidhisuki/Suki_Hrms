/**
 * GET /api/workforce/leave/preview?employeeId&leaveMasterId&from&to&isHalfDay
 *
 * HR-side twin of /api/workforce/my-leave/preview for the on-behalf entry
 * form: working days counted, skipped weekly offs / holidays, sandwiched
 * days, punched dates. Requires workforce.leave.edit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { computeLeaveDays } from '@/lib/leave/leaveDays';
import { planSummary } from '@/lib/leave/submission';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.leave.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const q = request.nextUrl.searchParams;
  const employeeId = Number(q.get('employeeId'));
  const leaveMasterId = Number(q.get('leaveMasterId'));
  const from = q.get('from');
  const to = q.get('to') ?? from;
  const isHalfDay = q.get('isHalfDay') === 'true';
  if (!employeeId || !leaveMasterId || !from || !to) {
    return NextResponse.json({ error: 'employeeId, leaveMasterId, from and to are required' }, { status: 400 });
  }
  if (!(await findEmployeeInCompany(employeeId, scope.companyId))) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }
  const leaveMaster = await prisma.leaveMaster.findFirst({
    where: { id: leaveMasterId, isActive: true, deletedAt: null },
    select: { isPaid: true, countSandwichedNonWorking: true },
  });
  if (!leaveMaster) return NextResponse.json({ error: 'Invalid leave type' }, { status: 400 });

  const plan = await computeLeaveDays({
    companyId: scope.companyId,
    employeeId,
    leaveMaster,
    from: new Date(`${from}T00:00:00.000Z`),
    to: new Date(`${to}T00:00:00.000Z`),
    isHalfDay,
  });
  return NextResponse.json(planSummary(plan));
}
