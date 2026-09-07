/**
 * Freeze guard for DailyAttendance writes — BRD §4.22/§29: "After freeze:
 * Edit = Disabled". MonthlyAttendanceSummary.status is the freeze gate;
 * every attendance create/correct route must check it before writing,
 * otherwise Finalize/Freeze on the Monthly page is cosmetic only.
 */

import { NextResponse } from 'next/server';
import { prisma } from './prisma';

export async function checkMonthNotFrozen(employeeId: number, date: Date): Promise<NextResponse | null> {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  const summary = await prisma.monthlyAttendanceSummary.findUnique({
    where: { employeeId_year_month: { employeeId, year, month } },
    select: { status: true },
  });

  if (summary?.status === 'FROZEN') {
    return NextResponse.json(
      { error: `Attendance for ${year}-${String(month).padStart(2, '0')} is frozen. Reopen the month first.` },
      { status: 409 }
    );
  }
  return null;
}
