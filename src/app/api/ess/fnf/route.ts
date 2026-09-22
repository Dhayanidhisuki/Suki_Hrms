/**
 * GET /api/ess/fnf — the signed-in employee's own F&F settlement(s).
 *
 * Visibility is deliberately narrower than "every settlement that exists for
 * this employee". Payroll's working states carry figures that are still
 * moving, and an employee reads any number on this page as a promise. See
 * essVisibility() in lib/fnf/workflow.ts for the rule and why it is anchored
 * on the notification catalogue.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { fnfInclude } from '@/lib/fnf/include';
import { loadKunFnfStatement } from '@/lib/fnf/kun-statement';
import { essVisibility } from '@/lib/fnf/workflow';

type SettlementRow = Awaited<ReturnType<typeof loadRows>>[number];

function loadRows(companyId: number, employeeId: number) {
  return prisma.fnFSettlement.findMany({
    where: { companyId, employeeId },
    include: fnfInclude,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * The status-only projection. An allowlist rather than a denylist of money
 * columns: FnFSettlement gains components over time (ptDeduction was added
 * this month), and a denylist silently starts leaking the next one.
 */
function withoutAmounts(s: SettlementRow) {
  return {
    id: s.id,
    status: s.status,
    lastWorkingDay: s.lastWorkingDay,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    // Why their money is delayed — the point of showing the row at all.
    holdReason: s.holdReason,
    rejectionReason: s.rejectionReason,
    employee: s.employee,
    exitInterview: s.exitInterview,
    amountsWithheld: true as const,
    lines: [],
    kunStatement: null,
  };
}

export async function GET(request: NextRequest) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const userId = Number(request.headers.get('x-user-id'));
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const employee = await prisma.employee.findFirst({
    where: { userId, companyId: scope.companyId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) {
    return NextResponse.json({ error: 'No employee record is linked to this login' }, { status: 404 });
  }

  const rows = await loadRows(scope.companyId, employee.id);

  const data = await Promise.all(
    rows
      .filter((s) => essVisibility(s.status) !== 'hidden')
      .map(async (s) =>
        essVisibility(s.status) === 'full'
          ? { ...s, amountsWithheld: false as const, kunStatement: await loadKunFnfStatement(s.id) }
          : withoutAmounts(s),
      ),
  );

  return NextResponse.json({ data });
}
