/**
 * GET /api/reports/payroll/payslip?year=&month=[&employeeId=][&format=json|pdf]
 *
 * Without employeeId: the Payslip Report table — every active employee for
 * the period with their net pay (list mode).
 * With employeeId: a single employee's payslip ("Time Card / Salary Slip
 * FORM-25B" format), sourced from an already-calculated PayrollLine — never
 * recomputes payroll. json = the data; pdf = the downloadable payslip
 * matching the company's paper format.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { getPayslipData, listPayslipSummaries } from '@/lib/payslipReport';
import { generatePayslipPdf } from '@/lib/payslipPdf';

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
  if (!employeeIdParam) {
    const data = await listPayslipSummaries(scope.companyId, year, month);
    return NextResponse.json({ data });
  }

  const employeeId = parseInt(employeeIdParam, 10);
  if (!Number.isInteger(employeeId)) {
    return NextResponse.json({ error: 'Invalid employeeId' }, { status: 400 });
  }
  const format = searchParams.get('format') ?? 'json';

  const data = await getPayslipData(scope.companyId, year, month, employeeId);
  if (!data) {
    return NextResponse.json({ error: 'No processed payroll found for this employee in this month.' }, { status: 404 });
  }

  if (format === 'pdf') {
    const pdfBytes = await generatePayslipPdf(data);
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="payslip-${data.employeeCode}-${year}-${String(month).padStart(2, '0')}.pdf"`,
      },
    });
  }

  return NextResponse.json({ data });
}
