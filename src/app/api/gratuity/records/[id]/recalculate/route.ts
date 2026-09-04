/**
 * POST /api/gratuity/records/[id]/recalculate — re-runs calculateGratuity for
 * this record's employee. Only while CALCULATED or NOT_ELIGIBLE (enforced
 * inside calculateGratuity itself).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { calculateGratuity } from '@/lib/gratuityCalculation';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.gratuity.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const record = await prisma.gratuityRecord.findFirst({ where: { id: Number(id), companyId: scope.companyId } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const updated = await calculateGratuity(scope.companyId, record.employeeId);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Cannot recalculate')) return NextResponse.json({ error: message }, { status: 409 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
