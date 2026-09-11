/**
 * POST /api/payroll/tds/declarations/[id]/reject
 *   Rejects a TDS investment declaration (HR action).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

const bodySchema = z.object({
  rejectionReason: z.string().min(1).max(500),
});

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

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'rejectionReason is required' }, { status: 400 });
  }

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
      status: 'rejected',
      rejectionReason: parsed.data.rejectionReason,
    },
  });

  return NextResponse.json(updated);
}
