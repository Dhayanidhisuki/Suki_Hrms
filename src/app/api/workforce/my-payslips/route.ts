/**
 * GET /api/workforce/my-payslips
 *   The logged-in employee's own payslips, newest first. Self-service:
 *   employeeId is resolved from the session, never taken from the client.
 *
 *   A month is returned as soon as payroll has computed a line for it, but
 *   `netSalary` and `payslipAvailable` are withheld until the run reaches
 *   APPROVED or LOCKED — a provisional figure must never reach the employee.
 *   Returning the row early is deliberate: previously anything unpublished
 *   was filtered out entirely, so a month mid-processing simply vanished and
 *   the employee could not tell it apart from one that was never run.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

const PUBLISHED_STATUSES = ['APPROVED', 'LOCKED'];
// DRAFT is excluded: nothing has been computed yet, so there is no meaningful
// state to report and listing it would imply work that has not started.
const IN_PROGRESS_STATUSES = ['CALCULATED', 'VALIDATED', 'SUBMITTED'];

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const lines = await prisma.payrollLine.findMany({
    where: {
      employeeId: ownEmployeeId,
      payrollRun: {
        companyId: scope.companyId,
        status: { in: [...PUBLISHED_STATUSES, ...IN_PROGRESS_STATUSES] },
      },
    },
    select: {
      id: true,
      netSalary: true,
      status: true,
      payrollRun: { select: { id: true, year: true, month: true, status: true, updatedAt: true } },
    },
    orderBy: [{ payrollRun: { year: 'desc' } }, { payrollRun: { month: 'desc' } }],
  });

  const data = lines.map((l) => {
    const published = PUBLISHED_STATUSES.includes(l.payrollRun.status);
    return {
      id: l.id,
      status: l.status,
      payrollRun: {
        id: l.payrollRun.id,
        year: l.payrollRun.year,
        month: l.payrollRun.month,
        status: l.payrollRun.status,
      },
      // Processing state, not the raw run status — an employee has no use for
      // the difference between CALCULATED and VALIDATED.
      payrollStatus: published ? 'PUBLISHED' : 'PROCESSING',
      processedOn: l.payrollRun.updatedAt,
      payslipAvailable: published,
      netSalary: published ? l.netSalary : null,
    };
  });

  return NextResponse.json({ data });
}
