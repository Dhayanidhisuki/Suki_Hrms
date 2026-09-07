/**
 * POST /api/payroll/revisions/[id]/cancel — DRAFT/SUBMITTED/HOLD → CANCELLED.
 * Not allowed once APPROVED (the salary version already exists by then).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

const CANCELLABLE_STATUSES = ['DRAFT', 'SUBMITTED', 'HOLD'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.revision.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const record = await prisma.salaryRevisionRequest.findFirst({ where: { id: Number(id), companyId: scope.companyId } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!CANCELLABLE_STATUSES.includes(record.status)) {
    return NextResponse.json({ error: `Cannot cancel a revision in ${record.status} status.` }, { status: 409 });
  }

  const updated = await prisma.salaryRevisionRequest.update({
    where: { id: record.id },
    data: { status: 'CANCELLED' },
  });

  return NextResponse.json(updated);
}
