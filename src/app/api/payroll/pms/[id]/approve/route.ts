/** POST /api/payroll/pms/[id]/approve — HR final approval (payroll.pms.approve).
 *  Also accepts 'draft' rows so HR can bulk-complete selected employees. */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { logActivity } from '@/lib/activity-log';

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
  if (!['draft', 'submitted', 'under_review', 'returned', 'pending_hr'].includes(record.status)) {
    return NextResponse.json({ error: `Already ${record.status} — nothing to approve` }, { status: 409 });
  }

  const userId = Number(request.headers.get('x-user-id')) || null;
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.pmsIncentive.update({
      where: { id: record.id },
      data: { status: 'approved', hrActionByUserId: userId, hrActionAt: new Date() },
    });
    await logActivity(tx, {
      employeeId: record.employeeId,
      activityType: 'pms_approved',
      module: 'pms',
      performedByUserId: userId,
      oldValue: { status: record.status },
      newValue: { status: 'approved' },
      relatedRecordId: record.id,
    });
    return saved;
  });
  return NextResponse.json(updated);
}
