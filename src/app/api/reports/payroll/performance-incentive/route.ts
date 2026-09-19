/**
 * GET /api/reports/payroll/performance-incentive?year=&month=&employeeId=&employeeIds=&format=json|pdf
 *
 * Employee-wise (employeeId set), a bulk selection (employeeIds, comma-
 * separated), or overall (neither set) view of the computed Performance
 * Incentive amount — see src/lib/performanceIncentiveReport.ts for the
 * formula. Read-only, standalone: never touches payroll. Excel export is
 * generated client-side from the same rows this returns as JSON (see the
 * report page) rather than a server format here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { computePerformanceIncentiveRows } from '@/lib/performanceIncentiveReport';
import { generatePerformanceIncentivePdf } from '@/lib/performanceIncentivePdf';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? '', 10);
  const month = parseInt(searchParams.get('month') ?? '', 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
  }
  const employeeIdParam = searchParams.get('employeeId');
  const employeeId = employeeIdParam ? parseInt(employeeIdParam, 10) : undefined;
  const employeeIdsParam = searchParams.get('employeeIds');
  const employeeIdSet = employeeIdsParam
    ? new Set(employeeIdsParam.split(',').map((s) => parseInt(s, 10)).filter((n) => Number.isInteger(n)))
    : null;
  const format = searchParams.get('format') ?? 'json';

  let rows = await computePerformanceIncentiveRows(scope.companyId, year, month, employeeId);
  if (employeeIdSet) rows = rows.filter((r) => employeeIdSet.has(r.employeeId));

  if (format === 'pdf') {
    const company = await prisma.company.findUnique({ where: { id: scope.companyId }, select: { name: true } });
    const isSingle = Boolean(employeeId) || (employeeIdSet !== null && employeeIdSet.size === 1);
    const pdfBytes = await generatePerformanceIncentivePdf(rows, {
      companyName: company?.name ?? 'Company',
      year,
      month,
      scope: isSingle ? 'employee' : 'overall',
    });
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="performance-incentive-${year}-${String(month).padStart(2, '0')}${employeeId ? `-emp${employeeId}` : ''}.pdf"`,
      },
    });
  }

  const totalFinal = rows.reduce((sum, r) => sum + r.finalAmount, 0);
  return NextResponse.json({ data: rows, totals: { count: rows.length, finalAmount: Math.round(totalFinal * 100) / 100 } });
}
