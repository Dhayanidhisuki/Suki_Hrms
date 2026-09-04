/**
 * POST /api/workforce/attendance/monthly/freeze
 * Body: { year, month, employeeId? }
 *
 * Locks a finalized month against further edits. Manual for Phase 1 — there's
 * no Payroll module yet to auto-trigger this on payroll approval (per BRD
 * §29), so an authorized HR user does it directly. Only FINALIZED months can
 * be frozen.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const month = Number(body?.month);
  const employeeIdFilter = body?.employeeId ? Number(body.employeeId) : undefined;

  if (!year || !month) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
  }

  const result = await prisma.monthlyAttendanceSummary.updateMany({
    where: {
      year,
      month,
      status: 'FINALIZED',
      employee: { companyId: scope.companyId, deletedAt: null },
      ...(employeeIdFilter ? { employeeId: employeeIdFilter } : {}),
    },
    data: { status: 'FROZEN', frozenAt: new Date() },
  });

  return NextResponse.json({ message: `Froze ${result.count} record(s)` });
}
