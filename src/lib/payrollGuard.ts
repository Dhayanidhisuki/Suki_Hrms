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
