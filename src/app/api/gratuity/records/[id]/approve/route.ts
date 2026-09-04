/**
 * POST /api/gratuity/records/[id]/approve — CALCULATED → APPROVED.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.gratuity.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const record = await prisma.gratuityRecord.findFirst({ where: { id: Number(id), companyId: scope.companyId } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (record.status !== 'CALCULATED') {
    return NextResponse.json({ error: `Cannot approve a gratuity record in ${record.status} status.` }, { status: 409 });
  }

  const updated = await prisma.gratuityRecord.update({
    where: { id: record.id },
    data: { status: 'APPROVED', approvedByUserId: performedByUserId, approvedAt: new Date() },
  });

  return NextResponse.json(updated);
}
