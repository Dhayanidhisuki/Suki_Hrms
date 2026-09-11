/** GET /api/payroll/pms/[id]/audit — audit trail for a Performance
 * Incentive row, read from EmployeeActivity where module = 'pms'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { findEmployeeInCompany } from '@/lib/companyScope';
import { getPmsAccess } from '@/lib/pmsIncentive';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getPmsAccess(request);
  if (access instanceof NextResponse) return access;

  const { id } = await params;
  const record = await prisma.pmsIncentive.findUnique({ where: { id: Number(id) } });
  if (!record || !(await findEmployeeInCompany(record.employeeId, access.companyId))) {
    return NextResponse.json({ error: 'PMS incentive submission not found' }, { status: 404 });
  }

  const trail = await prisma.employeeActivity.findMany({
    where: { module: 'pms', relatedRecordId: record.id },
    orderBy: { activityAt: 'desc' },

  });

  return NextResponse.json({
    data: trail.map((a) => ({
      id: a.id,
      changedBy: a.performedByUserId ? `User #${a.performedByUserId}` : 'System',
      role: a.activityType,
      field: a.activityType,
      activityType: a.activityType,
      oldValue: a.oldValue,
      newValue: a.newValue,
      reason: a.remarks,
      date: a.activityAt,
    })),
  });
}
