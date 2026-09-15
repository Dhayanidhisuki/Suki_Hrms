/**
 * POST /api/payroll/runs/[id]/auto-payroll
 *
 * One-click automation: Calculate → Approve → Mark all OK lines as PROCESSED.
 * Skips email for now (per user request) — status is visible in employee login.
 * HOLD lines are left as HOLD; only OK lines are marked PROCESSED.
 * If the run is already APPROVED, only the PROCESSED marking runs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { calculatePayrollRun } from '@/lib/payrollCalculation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const runId = parseInt(id);
  const userId = Number(request.headers.get('x-user-id'));

  const run = await prisma.payrollRun.findFirst({ where: { id: runId, companyId: scope.companyId } });
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (run.status === 'LOCKED' || run.status === 'POSTED') {
    return NextResponse.json({ error: `Run is ${run.status} — cannot auto-payroll` }, { status: 409 });
  }

  // Step 1: Calculate (if not yet approved)
  let calcResult: { calculated: number; onHold: number } | null = null;
  if (run.status === 'DRAFT' || run.status === 'CALCULATED') {
    calcResult = await calculatePayrollRun(runId);
  }

  // Step 2: Approve (if not yet approved)
  if (run.status !== 'APPROVED') {
    await prisma.payrollRun.update({
      where: { id: runId },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedByUserId: userId },
    });
  }

  // Step 3: Mark all OK lines as PROCESSED
  const lines = await prisma.payrollLine.findMany({
    where: { payrollRunId: runId },
    select: {
      id: true,
      status: true,
      employeeId: true,
      employee: {
        select: {
          employeeCode: true,
          firstName: true,
          lastName: true,
          officeEmail: true,
          personalDetails: { select: { personalEmail: true } },
        },
      },
    },
  });

  const okLineIds = lines.filter((l) => l.status === 'OK').map((l) => l.id);
  if (okLineIds.length > 0) {
    await prisma.payrollLine.updateMany({
      where: { id: { in: okLineIds } },
      data: { status: 'PROCESSED' },
    });
  }

  const holdLines = lines.filter((l) => l.status === 'HOLD');
  const processedCount = okLineIds.length;
  const holdCount = holdLines.length;

  // Resolve notification email for each processed employee:
  // officeEmail → personalEmail fallback. Email sending is not yet wired
  // (per user request — skip email for now), but we return the resolved
  // addresses so the frontend can display them and future email wiring
  // has the data ready.
  const processedEmployees = lines
    .filter((l) => l.status === 'PROCESSED' || okLineIds.includes(l.id))
    .map((l) => {
      const officeEmail = l.employee.officeEmail;
      const personalEmail = l.employee.personalDetails?.personalEmail ?? null;
      const notificationEmail = officeEmail ?? personalEmail ?? null;
      return {
        employeeCode: l.employee.employeeCode,
        name: `${l.employee.firstName} ${l.employee.lastName}`.trim(),
        officeEmail,
        personalEmail,
        notificationEmail,
      };
    });

  return NextResponse.json({
    message: `Auto-payroll complete: ${processedCount} processed, ${holdCount} on hold`,
    calculated: calcResult?.calculated ?? 0,
    onHold: holdCount,
    processed: processedCount,
    processedEmployees,
    holdEmployees: holdLines.map((l) => ({
      employeeCode: l.employee.employeeCode,
      name: `${l.employee.firstName} ${l.employee.lastName}`.trim(),
    })),
  });
}
