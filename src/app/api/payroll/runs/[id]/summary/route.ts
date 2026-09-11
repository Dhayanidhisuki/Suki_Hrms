/**
 * GET /api/payroll/runs/[id]/summary
 *
 * Returns a payroll summary for the run — totals by component type,
 * headcount, gross/net totals, statutory breakdown, and per-employee-type
 * breakdown. Used by the Payroll Summary page and export.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const runId = parseInt(id);

  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, companyId: scope.companyId },
  });
  if (!run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });

  const lines = await prisma.payrollLine.findMany({
    where: { payrollRunId: runId },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          jobInfos: { where: { effectiveTo: null }, take: 1, select: { employeeTypeId: true } },
        },
      },
    },
    orderBy: { employeeId: 'asc' },
  });

  const okLines = lines.filter((l) => l.status === 'OK');
  const holdLines = lines.filter((l) => l.status === 'HOLD');

  // Totals.
  const totals = okLines.reduce(
    (acc, l) => {
      acc.grossEarnings += Number(l.grossEarnings);
      acc.otAmount += Number(l.otAmount);
      acc.otherEarnings += Number(l.otherEarningsTotal);
      acc.pfEmployee += Number(l.pfEmployee);
      acc.pfEmployer += Number(l.pfEmployer);
      acc.epsEmployer += Number(l.epsEmployer);
      acc.esiEmployee += Number(l.esiEmployee);
      acc.esiEmployer += Number(l.esiEmployer);
      acc.professionalTax += Number(l.professionalTax);
      acc.tds += Number(l.tds);
      acc.otherDeductions += Number(l.otherDeductionsTotal);
      acc.lomAmount += Number(l.lomAmount);
      acc.lwfAmount += Number(l.lwfAmount);
      acc.healthInsurance += Number(l.healthInsurance);
      acc.netSalary += Number(l.netSalary);
      return acc;
    },
    {
      grossEarnings: 0, otAmount: 0, otherEarnings: 0,
      pfEmployee: 0, pfEmployer: 0, epsEmployer: 0,
      esiEmployee: 0, esiEmployer: 0,
      professionalTax: 0, tds: 0, otherDeductions: 0,
      lomAmount: 0, lwfAmount: 0, healthInsurance: 0,
      netSalary: 0,
    }
  );

  // Per-employee-type breakdown.
  const byType = new Map<string, { count: number; gross: number; net: number }>();
  for (const l of okLines) {
    const typeId = l.employee.jobInfos[0]?.employeeTypeId ?? 0;
    const key = String(typeId);
    const entry = byType.get(key) ?? { count: 0, gross: 0, net: 0 };
    entry.count++;
    entry.gross += Number(l.grossEarnings);
    entry.net += Number(l.netSalary);
    byType.set(key, entry);
  }

  // Load employee type names.
  const typeIds = Array.from(byType.keys()).map(Number).filter((n) => n > 0);
  const types = typeIds.length > 0
    ? await prisma.employeeType.findMany({ where: { id: { in: typeIds } }, select: { id: true, name: true } })
    : [];
  const typeName = new Map(types.map((t) => [String(t.id), t.name]));

  return NextResponse.json({
    run: { id: run.id, year: run.year, month: run.month, status: run.status },
    headcount: {
      total: lines.length,
      ok: okLines.length,
      hold: holdLines.length,
    },
    // Phase 16 — BRD §23 COMPLETED/PENDING/HOLD classification.
    classification: {
      COMPLETED: okLines.length,
      PENDING: lines.length - okLines.length - holdLines.length,
      HOLD: holdLines.length,
    },
    totals,
    byEmployeeType: Array.from(byType.entries()).map(([typeId, data]) => ({
      employeeTypeId: Number(typeId),
      employeeTypeName: typeName.get(typeId) ?? 'Unknown',
      ...data,
    })),
    holdReasons: holdLines.map((l) => ({
      employeeCode: l.employee.employeeCode,
      name: `${l.employee.firstName} ${l.employee.lastName}`.trim(),
      holdReason: l.holdReason,
    })),
  });
}
