/**
 * Attendance lock guard — the ONE rule every attendance writer consults.
 *
 * BRD §29 / client decision 2026-09-07: attendance must not be editable once
 * payroll for that month has been processed — a hard lock, no exceptions.
 * Three things lock a month for an employee:
 *
 *   1. MonthlyAttendanceSummary.status = FROZEN — HR froze it on the
 *      Monthly page.
 *   2. MonthlyAttendanceSummary.status = READY_FOR_PAYROLL — the formal
 *      hand-off to payroll. Before 2026-09-25 this state locked nothing:
 *      the guard checked FROZEN only, so "ready for payroll" was writable.
 *   3. A PayrollRun for the employee's company / year / month is APPROVED,
 *      LOCKED or POSTED — payroll processed. Covers months whose summary
 *      was never explicitly frozen, and makes the payroll side authoritative
 *      even if someone reopened attendance by hand in the database.
 *
 * Reads are never blocked; only writes consult this. See
 * docs/TIME_OFFICE_FLOW_AUDIT_2026-09-25.md §C for what leaked before.
 */

import { NextResponse } from 'next/server';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma';

type Db = PrismaClient | Prisma.TransactionClient;

export const LOCKED_SUMMARY_STATUSES = ['FROZEN', 'READY_FOR_PAYROLL'] as const;
export const LOCKED_PAYROLL_STATUSES = ['APPROVED', 'LOCKED', 'POSTED'] as const;

export interface AttendanceLock {
  reason: 'FROZEN' | 'READY_FOR_PAYROLL' | 'PAYROLL_PROCESSED';
  year: number;
  month: number;
  message: string;
}

function periodLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Company-level half of the rule: has payroll for this period been processed?
 * Exposed on its own for the month-level routes (finalize / reopen) that hold
 * a company + period rather than an employee.
 */
export async function isPayrollProcessed(companyId: number, year: number, month: number, db: Db = prisma): Promise<string | null> {
  const run = await db.payrollRun.findFirst({
    where: { companyId, year, month, status: { in: [...LOCKED_PAYROLL_STATUSES] } },
    select: { status: true },
  });
  return run?.status ?? null;
}

/** Why this employee's month cannot be written, or null when it is open. */
export async function getAttendanceLock(employeeId: number, date: Date, db: Db = prisma): Promise<AttendanceLock | null> {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const label = periodLabel(year, month);

  const summary = await db.monthlyAttendanceSummary.findUnique({
    where: { employeeId_year_month: { employeeId, year, month } },
    select: { status: true },
  });
  if (summary?.status === 'FROZEN') {
    return { reason: 'FROZEN', year, month, message: `Attendance for ${label} is frozen. Reopen the month first.` };
  }
  if (summary?.status === 'READY_FOR_PAYROLL') {
    return {
      reason: 'READY_FOR_PAYROLL',
      year,
      month,
      message: `Attendance for ${label} has been handed off to payroll (Ready for Payroll). Reopen the month first.`,
    };
  }

  const employee = await db.employee.findUnique({ where: { id: employeeId }, select: { companyId: true } });
  if (!employee) return null;
  const payrollStatus = await isPayrollProcessed(employee.companyId, year, month, db);
  if (payrollStatus) {
    return {
      reason: 'PAYROLL_PROCESSED',
      year,
      month,
      message: `Payroll for ${label} is ${payrollStatus.toLowerCase()} — attendance for that month can no longer be changed.`,
    };
  }
  return null;
}

export async function isAttendanceLocked(employeeId: number, date: Date, db: Db = prisma): Promise<boolean> {
  return (await getAttendanceLock(employeeId, date, db)) !== null;
}

export function lockResponse(lock: AttendanceLock): NextResponse {
  return NextResponse.json(
    { error: lock.message, lock: { reason: lock.reason, year: lock.year, month: lock.month } },
    { status: 409 }
  );
}

/** Route-shaped guard: a 409 when the employee's month is locked, else null. */
export async function checkMonthNotFrozen(employeeId: number, date: Date): Promise<NextResponse | null> {
  const lock = await getAttendanceLock(employeeId, date);
  return lock ? lockResponse(lock) : null;
}

/** First-of-month UTC dates for every calendar month touched by [from, to]. */
export function monthsBetween(from: Date, to: Date): Date[] {
  const months: Date[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor <= end) {
    months.push(new Date(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

/**
 * Same guard over a date range — EVERY month between the two dates is
 * checked, not just the ends. A leave spanning three months used to skip the
 * middle one.
 */
export async function getAttendanceLockInRange(employeeId: number, from: Date, to: Date, db: Db = prisma): Promise<AttendanceLock | null> {
  for (const monthStart of monthsBetween(from, to)) {
    const lock = await getAttendanceLock(employeeId, monthStart, db);
    if (lock) return lock;
  }
  return null;
}

export async function checkRangeNotFrozen(employeeId: number, from: Date, to: Date): Promise<NextResponse | null> {
  const lock = await getAttendanceLockInRange(employeeId, from, to);
  return lock ? lockResponse(lock) : null;
}
