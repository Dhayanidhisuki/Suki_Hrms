/**
 * GET /api/payroll/double-machine/[id]/audit — the activity trail for one
 * incentive row.
 *
 * The module has written EmployeeActivity rows under module='double-machine'
 * since it was built, but exposed no way to read them back. Now that these
 * figures are paid by payroll, who changed an amount and who approved it needs
 * to be answerable. Mirrors api/payroll/pms/[id]/audit/route.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const record = await prisma.doubleMachineIncentive.findUnique({ where: { id: Number(id) } });
  if (!record || record.companyId !== scope.companyId
      || !(await findEmployeeInCompany(record.employeeId, scope.companyId))) {
    return NextResponse.json({ error: 'Incentive record not found' }, { status: 404 });
  }

  const entries = await prisma.employeeActivity.findMany({
    where: { module: 'double-machine', relatedRecordId: record.id },
    orderBy: { activityAt: 'desc' },
    take: 100,
  });

  const userIds = [...new Set(entries.map((e) => e.performedByUserId).filter((n): n is number => !!n))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
    : [];
  const byId = new Map(users.map((u) => [u.id, u.email]));

  return NextResponse.json({
    data: entries.map((e) => ({
      id: e.id,
      activityType: e.activityType,
      at: e.activityAt.toISOString(),
      by: e.performedByUserId ? byId.get(e.performedByUserId) ?? null : null,
      oldValue: e.oldValue,
      newValue: e.newValue,
    })),
  });
}
