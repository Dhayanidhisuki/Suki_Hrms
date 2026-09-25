/**
 * POST /api/workforce/mispunch/[id]/cancel
 *
 * The requesting employee withdraws their own correction while it is still
 * awaiting a decision (pending_manager or pending_hr). Nothing has been
 * written to DailyAttendance at either of those stages, so there is nothing
 * to reverse — the request simply leaves both approval queues. An approved
 * or rejected request cannot be withdrawn.
 *
 * Until 2026-09-25 the "one open request per date" 409 told the employee to
 * cancel the earlier request, but no such route existed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { notifyEssRequest, formatPeriod } from '@/lib/ess/notifyRequest';

const WITHDRAWABLE = new Set(['pending_manager', 'pending_hr']);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const mispunchId = Number(id);
  const record = await prisma.mispunchCorrection.findUnique({ where: { id: mispunchId } });
  if (!record || record.employeeId !== ownEmployeeId) {
    return NextResponse.json({ error: 'Mispunch correction request not found' }, { status: 404 });
  }
  if (!WITHDRAWABLE.has(record.status)) {
    return NextResponse.json({ error: `A ${record.status} request can no longer be withdrawn` }, { status: 409 });
  }

  const updated = await prisma.mispunchCorrection.update({
    where: { id: mispunchId },
    data: { status: 'cancelled' },
  });

  await notifyEssRequest({
    companyId: scope.companyId,
    kind: 'MISPUNCH',
    action: 'CANCELLED',
    employeeId: record.employeeId,
    requestId: mispunchId,
    period: formatPeriod(record.date),
    reason: record.reason,
    linkPath: '/ess/mis-punch',
  });

  return NextResponse.json(updated);
}
