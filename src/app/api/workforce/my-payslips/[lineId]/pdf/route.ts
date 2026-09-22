/**
 * GET /api/workforce/my-payslips/[lineId]/pdf
 *   The logged-in employee's own payslip as a downloadable PDF, same
 *   "Time Card / Salary Slip (FORM-25B)" format as Reports > Payroll >
 *   Payslip — built from the same getPayslipData/generatePayslipPdf used
 *   there. Self-scoped (no payroll.processing.view permission needed) and
 *   gated to APPROVED/LOCKED runs only, matching my-payslips/[lineId].
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { getPayslipData } from '@/lib/payslipReport';
import { generatePayslipPdf } from '@/lib/payslipPdf';

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
    select: { employeeId: true, payrollRun: { select: { year: true, month: true } } },
  });
  if (!line) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const data = await getPayslipData(scope.companyId, line.payrollRun.year, line.payrollRun.month, line.employeeId);
  if (!data) {
    return NextResponse.json({ error: 'No processed payroll found for this month.' }, { status: 404 });
  }

  const pdfBytes = await generatePayslipPdf(data);
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="payslip-${data.employeeCode}-${line.payrollRun.year}-${String(line.payrollRun.month).padStart(2, '0')}.pdf"`,
    },
  });
}
