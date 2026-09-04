/**
 * POST /api/workforce/leave/applications/[id]/reject
 * Body: { rejectionReason }
 *
 * Rejection requires a reason (BRD §14: "Rejection reason should be
 * captured") and does not touch balance or attendance — per BRD §11,
 * "Rejected leave shall not reduce leave balance."
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { leaveRejectSchema } from '@/lib/validations/workforce';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'workforce.leave.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const applicationId = parseInt(id);

  const application = await prisma.leaveApplication.findFirst({
    where: { id: applicationId, employee: { companyId: scope.companyId, deletedAt: null } },
  });
  if (!application) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (application.status !== 'pending') {
    return NextResponse.json({ error: `Cannot reject a ${application.status} application` }, { status: 409 });
  }

  const parsed = leaveRejectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await prisma.leaveApplication.update({
    where: { id: applicationId },
    data: { status: 'rejected', rejectionReason: parsed.data.rejectionReason },
  });

  return NextResponse.json(updated);
}
