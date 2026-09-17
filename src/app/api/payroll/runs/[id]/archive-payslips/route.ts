/**
 * POST /api/payroll/runs/[id]/archive-payslips
 *
 * Renders payslips server-side and files them into the Document Module, so
 * payroll documents are "automatically indexed" per the KUN Document Module
 * BRD. Body: { employeeId? } — one employee, or the whole run when omitted.
 *
 * Idempotent: indexGeneratedPdf de-duplicates on the file hash, so re-running
 * this for a run reports the unchanged payslips as skipped rather than
 * filing duplicates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveDocumentActor } from '@/lib/platform/document/actor';
import { archivePayslip, archiveRunPayslips } from '@/lib/payroll/payslip-pdf';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Filing a payslip publishes pay data into the document hub, so this needs
  // the payroll edit right, not the read-only view right the payslip data
  // endpoint uses.
  const permErr = await checkSpecificPermission(request, 'payroll.processing.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const runId = Number((await params).id);
  if (!Number.isInteger(runId) || runId <= 0) {
    return NextResponse.json({ error: 'Invalid payroll run id' }, { status: 400 });
  }

  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, companyId: scope.companyId },
    select: { id: true },
  });
  if (!run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { employeeId?: unknown };
  const { actor } = await resolveDocumentActor(request, scope.companyId);

  try {
    if (body.employeeId != null) {
      const employeeId = Number(body.employeeId);
      if (!Number.isInteger(employeeId) || employeeId <= 0) {
        return NextResponse.json({ error: 'Invalid employeeId' }, { status: 400 });
      }
      const filed = await archivePayslip(scope.companyId, runId, employeeId, actor);
      if (!filed) {
        // Either no payroll line for this employee, or the identical payslip
        // is already on file — both are a no-op, not an error.
        return NextResponse.json({ filed: 0, skipped: 1 });
      }
      return NextResponse.json({ filed: 1, skipped: 0 });
    }

    return NextResponse.json(await archiveRunPayslips(scope.companyId, runId, actor));
  } catch (err) {
    console.error('[archive-payslips] failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to archive payslips' },
      { status: 500 },
    );
  }
}
