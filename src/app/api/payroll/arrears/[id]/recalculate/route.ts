/**
 * POST /api/payroll/arrears/[id]/recalculate — re-runs calculateArrear for
 * the underlying revision request. Blocked once the arrear is APPLIED.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { calculateArrear } from '@/lib/arrearCalculation';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.revision.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;

  const record = await prisma.salaryArrear.findFirst({ where: { id: Number(id), companyId: scope.companyId } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const arrear = await calculateArrear(record.salaryRevisionRequestId);
    if (!arrear) {
      return NextResponse.json({ error: 'No processed payroll months remain affected by this revision — arrear removed.' }, { status: 200 });
    }
    return NextResponse.json(arrear);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('already been applied')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw err;
  }
}
