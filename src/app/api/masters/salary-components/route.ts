/**
 * GET /api/masters/salary-components — read-only listing of the seeded
 * SalaryComponent catalog (35 components from payroll.rpt, seeded via
 * scripts/seed-salary-components.mjs), used to populate the Salary Details
 * tab's component picker. No create/edit here — the catalog is managed by
 * the seed script, not through the UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  const data = await prisma.salaryComponent.findMany({
    where: { deletedAt: null, isActive: true, ...(type ? { type } : {}) },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ data });
}
