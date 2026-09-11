/**
 * POST /api/payroll/manual-arrears/[id]/approve
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
  const arrearId = parseInt(id);
  const userId = Number(request.headers.get('x-user-id'));

  const arrear = await prisma.manualArrear.findFirst({
    where: { id: arrearId, companyId: scope.companyId },
  });
  if (!arrear) return NextResponse.json({ error: 'Arrear not found' }, { status: 404 });
  if (arrear.status !== 'PENDING') {
    return NextResponse.json({ error: `Arrear is already ${arrear.status}` }, { status: 409 });
  }

  const updated = await prisma.manualArrear.update({
    where: { id: arrearId },
    data: { status: 'APPROVED', approvedByUserId: userId, approvedAt: new Date() },
  });

  return NextResponse.json(updated);
}
