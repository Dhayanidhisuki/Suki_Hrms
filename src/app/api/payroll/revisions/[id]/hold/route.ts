/**
 * POST /api/payroll/revisions/[id]/hold — SUBMITTED → HOLD.
 * Requires holdReason (BRD §13.1). Employee Master/Payroll are untouched
 * (BR-09).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { holdRevisionSchema } from '@/lib/validations/payroll';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.revision.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const parsed = holdRevisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.salaryRevisionRequest.findFirst({ where: { id: Number(id), companyId: scope.companyId } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (record.status !== 'SUBMITTED') {
    return NextResponse.json({ error: `Cannot hold a revision in ${record.status} status.` }, { status: 409 });
  }

  const updated = await prisma.salaryRevisionRequest.update({
    where: { id: record.id },
    data: { status: 'HOLD', holdReason: parsed.data.holdReason },
  });

  return NextResponse.json(updated);
}
