/**
 * POST /api/payroll/fnf/[id]/calculate
 *   Calculates all FnF components and updates the settlement record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { calculateFnF } from '@/lib/fnfCalculation';

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
  if (settlement.status !== 'pending') {
    return NextResponse.json({ error: `Settlement is already ${settlement.status}` }, { status: 409 });
  }

  try {
    const calc = await calculateFnF(settlement.employeeId, settlement.exitInterviewId, scope.companyId);
    const updated = await prisma.fnFSettlement.update({
      where: { id: settlementId },
      data: {
        ...calc,
        status: 'calculated',
        calculatedByUserId: userId,
        calculatedAt: new Date(),
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Calculation failed' }, { status: 500 });
  }
}
