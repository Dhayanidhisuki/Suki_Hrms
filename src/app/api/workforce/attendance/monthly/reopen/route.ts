/**
 * POST /api/workforce/attendance/monthly/reopen
 * Body: { year, month, employeeId?, reason }
 *
 * Authorized reopen of a frozen month — reason is mandatory (BRD §29:
 * "capture reopen date/time, user, reason"). Moves status back to OPEN so
 * DailyAttendance rows can be corrected again; does not itself touch any
 * DailyAttendance data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { reopenMonthSchema } from '@/lib/validations/workforce';
import { isPayrollProcessed, LOCKED_SUMMARY_STATUSES } from '@/lib/attendanceFreeze';

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

  const parsed = reopenMonthSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const userId = Number(request.headers.get('x-user-id'));

  // Hard lock (client rule 2026-09-07): once payroll for the month is
  // processed, attendance is closed for good. Reopen the payroll run first
  // — attendance must never silently diverge from what was paid.
  const payrollStatus = await isPayrollProcessed(scope.companyId, year, month);
  if (payrollStatus) {
    return NextResponse.json(
      {
        error: `Payroll for ${year}-${String(month).padStart(2, '0')} is ${payrollStatus.toLowerCase()} — attendance cannot be reopened. Reopen payroll first.`,
      },
      { status: 409 }
    );
  }

  // Both locked states reopen to OPEN. READY_FOR_PAYROLL used to be a dead
  // end: it locked nothing yet could not be reopened either.
  const targets = await prisma.monthlyAttendanceSummary.findMany({
    where: {
      year,
      month,
      status: { in: [...LOCKED_SUMMARY_STATUSES] },
      employee: { companyId: scope.companyId, deletedAt: null },
      ...(employeeIdFilter ? { employeeId: employeeIdFilter } : {}),
    },
    select: { id: true, employeeId: true },
  });

  const result = await prisma.monthlyAttendanceSummary.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: {
      status: 'OPEN',
      reopenedAt: new Date(),
      reopenedByUserId: userId,
      reopenReason: parsed.data.reason,
    },
  });

  // Phase 15 — Auto-recalculate monthly summaries after reopen so the
  // refreshed DailyAttendance data flows into the summary immediately.
  // This ensures payroll sees the latest attendance data when it recalculates.
  // Only the employees actually reopened — refreshing the whole company used
  // to rewrite counts on other employees' still-frozen months.
  if (result.count > 0) {
    const { refreshMonthlySummary } = await import('@/lib/biometricConversion');
    await Promise.all(targets.map((t) => refreshMonthlySummary(t.employeeId, year, month)));
  }

  return NextResponse.json({ message: `Reopened ${result.count} record(s)` });
}
