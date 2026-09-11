/**
 * POST /api/payroll/tds/declarations/[id]/approve
 *   Approves a TDS investment declaration (HR action).
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
  const declarationId = parseInt(id);
  const userId = Number(request.headers.get('x-user-id'));

  const declaration = await prisma.tdsInvestmentDeclaration.findFirst({
    where: { id: declarationId, companyId: scope.companyId },
  });
  if (!declaration) {
    return NextResponse.json({ error: 'Declaration not found' }, { status: 404 });
  }
  if (declaration.status !== 'pending_hr') {
    return NextResponse.json({ error: `Declaration is already ${declaration.status}` }, { status: 409 });
  }

  const updated = await prisma.tdsInvestmentDeclaration.update({
    where: { id: declarationId },
    data: {
      status: 'approved',
      approvedByUserId: userId,
      approvedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
