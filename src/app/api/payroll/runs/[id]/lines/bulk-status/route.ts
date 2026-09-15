/**
 * POST /api/payroll/runs/[id]/lines/bulk-status
 *
 * Change the status of multiple payroll lines at once. Used by the
 * multi-select toolbar on the salary processing page.
 *
 * Body: {
 *   lineIds: number[],
 *   status: 'OK' | 'HOLD' | 'PROCESSED',
 *   holdReason?: string  // required when status === 'HOLD'
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { z } from 'zod';

const bodySchema = z.object({
  lineIds: z.array(z.number().int().positive()).min(1),
  status: z.enum(['OK', 'HOLD', 'PROCESSED']),
  holdReason: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const runId = parseInt(id);

  const run = await prisma.payrollRun.findFirst({ where: { id: runId, companyId: scope.companyId } });
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (run.status === 'LOCKED' || run.status === 'POSTED') {
    return NextResponse.json({ error: `Run is ${run.status} — cannot modify lines` }, { status: 409 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.status === 'HOLD' && !parsed.data.holdReason?.trim()) {
    return NextResponse.json({ error: 'holdReason is required when status is HOLD' }, { status: 400 });
  }

  // Verify all line IDs belong to this run
  const lines = await prisma.payrollLine.findMany({
    where: { id: { in: parsed.data.lineIds }, payrollRunId: runId },
    select: { id: true },
  });
  if (lines.length !== parsed.data.lineIds.length) {
    return NextResponse.json({ error: 'Some lines do not belong to this run' }, { status: 400 });
  }

  const updateData: { status: string; holdReason: string | null } = {
    status: parsed.data.status,
    holdReason: parsed.data.status === 'HOLD' ? parsed.data.holdReason! : null,
  };

  await prisma.payrollLine.updateMany({
    where: { id: { in: parsed.data.lineIds }, payrollRunId: runId },
    data: updateData,
  });

  return NextResponse.json({
    message: `${lines.length} line(s) updated to ${parsed.data.status}`,
    updated: lines.length,
    status: parsed.data.status,
  });
}
