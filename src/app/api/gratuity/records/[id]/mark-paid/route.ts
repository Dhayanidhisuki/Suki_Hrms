/**
 * POST /api/gratuity/records/[id]/mark-paid — APPROVED → PAID. Body:
 * { paymentDate, paymentReference }. Terminal — no further edits after this.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { markGratuityPaidSchema } from '@/lib/validations/gratuity';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.gratuity.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const parsed = markGratuityPaidSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.gratuityRecord.findFirst({ where: { id: Number(id), companyId: scope.companyId } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (record.status !== 'APPROVED') {
    return NextResponse.json({ error: `Cannot mark paid a gratuity record in ${record.status} status.` }, { status: 409 });
  }

  const updated = await prisma.gratuityRecord.update({
    where: { id: record.id },
    data: {
      status: 'PAID',
      paymentDate: parsed.data.paymentDate,
      paymentReference: parsed.data.paymentReference,
    },
  });

  return NextResponse.json(updated);
}
