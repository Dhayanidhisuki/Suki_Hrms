/**
 * POST /api/payroll/runs/[id]/lock — APPROVED -> LOCKED (final; no
 *      further edits, mirrors Attendance's freeze).
 *
 * Locking is also where payslips are filed into the Document Module: the
 * KUN Document Module BRD wants payroll documents indexed automatically by
 * the module that produces them, and a locked run is the first point at
 * which a payslip is final.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveDocumentActor } from '@/lib/platform/document/actor';
import { archiveRunPayslips } from '@/lib/payroll/payslip-pdf';

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

  const run = await prisma.payrollRun.findFirst({ where: { id: runId, companyId: scope.companyId } });
  if (!run) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (run.status !== 'APPROVED') {
    return NextResponse.json({ error: `Cannot lock a run that is ${run.status} — approve it first` }, { status: 409 });
  }

  // Locking payroll IS the attendance hard lock (client rule 2026-09-07:
  // "attendance must not be editable after payroll is processed"). Freeze
  // every summary for the period in the same transaction so the Monthly
  // page shows the truth and no writer can slip through on a summary that
  // was only FINALIZED. (getAttendanceLock also checks the run status, so
  // even an employee with no summary row is covered.)
  const now = new Date();
  const [updated, frozen] = await prisma.$transaction([
    prisma.payrollRun.update({
      where: { id: runId },
      data: { status: 'LOCKED', lockedAt: now },
    }),
    prisma.monthlyAttendanceSummary.updateMany({
      where: {
        year: run.year,
        month: run.month,
        status: { not: 'FROZEN' },
        employee: { companyId: scope.companyId, deletedAt: null },
      },
      data: { status: 'FROZEN', frozenAt: now },
    }),
  ]);

  // File the payslips, but never fail the lock over it — the run is already
  // locked, and archiving is idempotent, so a failure here can be retried via
  // POST /api/payroll/runs/[id]/archive-payslips without side effects.
  let payslips: { filed: number; skipped: number } | null = null;
  let payslipError: string | null = null;
  try {
    const { actor } = await resolveDocumentActor(request, scope.companyId);
    payslips = await archiveRunPayslips(scope.companyId, runId, actor);
  } catch (err) {
    payslipError = err instanceof Error ? err.message : 'Failed to archive payslips';
    console.error('[payroll/lock] payslip archival failed', err);
  }

  return NextResponse.json({ ...updated, attendanceFrozen: frozen.count, payslips, payslipError });
}
