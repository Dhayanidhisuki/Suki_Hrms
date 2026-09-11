/** POST /api/payroll/pms/[id]/return { reason } — HR only. */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-log';

const returnSchema = z.object({
  reason: z.string().min(1).max(500),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.pms.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = returnSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const record = await prisma.pmsIncentive.findUnique({ where: { id: Number(id) } });
  if (!record || !(await findEmployeeInCompany(record.employeeId, scope.companyId))) {
    return NextResponse.json({ error: 'PMS incentive submission not found' }, { status: 404 });
  }
  if (!['submitted', 'under_review', 'approved', 'pending_hr'].includes(record.status)) {
    return NextResponse.json({ error: `Already ${record.status} — nothing to return` }, { status: 409 });
  }

  const userId = Number(request.headers.get('x-user-id')) || null;
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.pmsIncentive.update({
      where: { id: record.id },
      data: { status: 'returned', rejectionReason: parsed.data.reason },
    });
    await logActivity(tx, {
      employeeId: record.employeeId,
      activityType: 'pms_returned',
      module: 'pms',
      performedByUserId: userId,
      oldValue: { status: record.status },
      newValue: { status: 'returned' },
      remarks: parsed.data.reason,
      relatedRecordId: record.id,
    });
    return saved;
  });
  return NextResponse.json(updated);
}
