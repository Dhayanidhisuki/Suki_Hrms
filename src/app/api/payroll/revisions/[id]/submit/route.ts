/**
 * POST /api/payroll/revisions/[id]/submit — DRAFT → SUBMITTED.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.revision.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const record = await prisma.salaryRevisionRequest.findFirst({ where: { id: Number(id), companyId: scope.companyId } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (record.status !== 'DRAFT') {
    return NextResponse.json({ error: `Cannot submit a revision in ${record.status} status.` }, { status: 409 });
  }

  const updated = await prisma.salaryRevisionRequest.update({
    where: { id: record.id },
    data: { status: 'SUBMITTED' },
  });

  return NextResponse.json(updated);
}
