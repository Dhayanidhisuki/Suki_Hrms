/** POST /api/payroll/pms/[id]/approve — HR final approval (payroll.pms.approve). Single-stage — see PmsIncentive.status comment. */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.pms.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const record = await prisma.pmsIncentive.findUnique({ where: { id: Number(id) } });
  if (!record || !(await findEmployeeInCompany(record.employeeId, scope.companyId))) {
    return NextResponse.json({ error: 'PMS incentive submission not found' }, { status: 404 });
  }
  if (record.status !== 'pending_hr') {
    return NextResponse.json({ error: `Already ${record.status} — nothing to approve` }, { status: 409 });
  }

  const userId = Number(request.headers.get('x-user-id')) || null;
  const updated = await prisma.pmsIncentive.update({
    where: { id: record.id },
    data: { status: 'approved', hrActionByUserId: userId, hrActionAt: new Date() },
  });
  return NextResponse.json(updated);
}
