/**
 * Editability guard for PayrollRun writes — once APPROVED or LOCKED, no
 * further recalculation or ad-hoc component edits are allowed. Mirrors
 * src/lib/attendanceFreeze.ts's checkMonthNotFrozen pattern.
 */

import { NextResponse } from 'next/server';
import { prisma } from './prisma';

export async function checkPayrollRunEditable(payrollRunId: number): Promise<NextResponse | null> {
  const run = await prisma.payrollRun.findUnique({ where: { id: payrollRunId }, select: { status: true } });
  if (!run) {
    return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
  }
  if (run.status === 'APPROVED' || run.status === 'LOCKED') {
    return NextResponse.json(
      { error: `Payroll run is ${run.status.toLowerCase()} and can no longer be edited.` },
      { status: 409 }
    );
  }
  return null;
}

/**
 * Same guard, addressed by period instead of run id — for the upstream modules
 * that feed payroll (Double Machine / Other Incentives, and in future PMS),
 * which hold a (year, month) and never a payrollRunId.
 *
 * No run for the period means nothing has been paid yet, so the period is
 * editable. Only APPROVED/LOCKED blocks: a CALCULATED run is still expected to
 * be recalculated after its inputs change.
 *
 * Before this existed, no input module called the guard at all — an incentive
 * could be keyed or approved after the payslip for that month had gone out,
 * silently diverging from what was paid.
 */
export async function checkPeriodEditable(
  companyId: number,
  year: number,
  month: number
): Promise<NextResponse | null> {
  const run = await prisma.payrollRun.findFirst({
    where: { companyId, year, month },
    select: { status: true },
  });
  if (!run) return null;
  if (run.status === 'APPROVED' || run.status === 'LOCKED') {
    return NextResponse.json(
      {
        error: `Payroll for ${String(month).padStart(2, '0')}/${year} is ${run.status.toLowerCase()} — `
          + 'incentives for this period can no longer be changed.',
      },
      { status: 409 }
    );
  }
  return null;
}
