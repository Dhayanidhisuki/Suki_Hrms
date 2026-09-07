/**
 * GET /api/employees/[id]/confirmation/letter — downloads the Confirmation
 * Letter PDF. Only available once the employee has actually been confirmed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { generateConfirmationLetterPdf } from '@/lib/confirmation-letter';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;

  const { id } = await params;
  const employeeId = parseInt(id);

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    include: {
      company: { select: { name: true } },
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        include: { designation: { select: { name: true } }, department: { select: { name: true } } },
      },
    },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const currentJob = employee.jobInfos[0];
  if (!currentJob?.confirmationDate) {
    return NextResponse.json({ error: 'Employee has not been confirmed yet' }, { status: 409 });
  }

  const displayCode = employee.oldEmployeeCode ?? employee.employeeCode;

  const pdfBytes = await generateConfirmationLetterPdf({
    companyName: employee.company.name,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    employeeCode: displayCode,
    designation: currentJob.designation.name,
    department: currentJob.department.name,
    joinDate: currentJob.joinDate,
    confirmationDate: currentJob.confirmationDate,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="confirmation-letter-${displayCode}.pdf"`,
    },
  });
}
