/**
 * GET /api/gratuity/records/[id] — full detail for one gratuity record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.gratuity.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const record = await prisma.gratuityRecord.findFirst({
    where: { id: Number(id), companyId: scope.companyId },
    include: {
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      exitInterview: { select: { exitType: true, exitReason: true } },
    },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(record);
}
