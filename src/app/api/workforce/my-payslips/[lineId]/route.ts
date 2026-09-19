/**
 * GET /api/workforce/my-payslips/[lineId]
 *   The full itemized breakdown of one of the logged-in employee's own
 *   payslips — same shape as the HR route at
 *   /api/payroll/runs/[id]/lines/[lineId], but self-scoped (no
 *   payroll.processing.view permission needed) and gated to
 *   APPROVED/LOCKED runs only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

const PUBLISHED_STATUSES = ['APPROVED', 'LOCKED'];

export async function GET(request: NextRequest, { params }: { params: Promise<{ lineId: string }> }) {
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

  const { lineId } = await params;

  const line = await prisma.payrollLine.findFirst({
    where: {
      id: parseInt(lineId),
      employeeId: ownEmployeeId,
      payrollRun: { companyId: scope.companyId, status: { in: PUBLISHED_STATUSES } },
    },
    include: {
      payrollRun: { select: { year: true, month: true, status: true } },
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      components: { include: { salaryComponent: { select: { code: true, name: true, type: true, grossTier: true, includeInGross: true } } } },
    },
  });
  if (!line) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(line);
}
