/**
 * POST /api/payroll/fnf/[id]/approve
 *   Approves a calculated FnF settlement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.manage');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const settlementId = parseInt(id);
  const userId = Number(request.headers.get('x-user-id'));

  const settlement = await prisma.fnFSettlement.findFirst({
    where: { id: settlementId, companyId: scope.companyId },
  });
  if (!settlement) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
  if (settlement.status !== 'calculated') {
    return NextResponse.json({ error: `Settlement must be calculated first (current: ${settlement.status})` }, { status: 409 });
  }

  const updated = await prisma.fnFSettlement.update({
    where: { id: settlementId },
    data: {
      status: 'approved',
      approvedByUserId: userId,
      approvedAt: new Date(),
      settlementDate: new Date(),
    },
  });

  return NextResponse.json(updated);
}
