/**
 * POST /api/workforce/attendance/monthly/freeze
 * Body: { year, month, employeeId? }
 *
 * Locks a finalized month against further edits. Manual for Phase 1 — an
 * authorized HR user does it directly. Only FINALIZED months can be frozen.
 *
 * Freezing also auto-triggers Payroll: any PayrollRun for this
 * company/year/month still in DRAFT or CALCULATED (i.e. not yet APPROVED/
 * LOCKED — see PayrollRun.status comment in prisma/schema.prisma) is
 * recalculated via calculatePayrollRun so per-employee HOLD lines that
 * existed only because attendance wasn't finalized yet clear automatically,
 * without a separate manual "Calculate" click. Runs already APPROVED/LOCKED
 * are never touched.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { calculatePayrollRun } from '@/lib/payrollCalculation';

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

  let payrollRecalculated = false;
  if (result.count > 0) {
    const recalculableRuns = await prisma.payrollRun.findMany({
      where: { companyId: scope.companyId, year, month, status: { in: ['DRAFT', 'CALCULATED'] } },
      select: { id: true },
    });
    for (const run of recalculableRuns) {
      await calculatePayrollRun(run.id);
      payrollRecalculated = true;
    }
  }

  return NextResponse.json({ message: `Froze ${result.count} record(s)`, payrollRecalculated });
}
