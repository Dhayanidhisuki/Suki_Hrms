/**
 * Push to Employee — POST /api/recruitment/push-to-employee
 * BRD §5.17, §9. Converts a candidate to an Employee Master record.
 * Auto-generates Employee ID using the company-configurable EmployeeIdConfig.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pushToEmployeeSchema } from '@/lib/validations/recruitment';
import { generateEmployeeCode } from '@/lib/recruitment/employee-id-generator';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = pushToEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const candidate = await prisma.candidate.findFirst({
    where: { id: parsed.data.candidateId, deletedAt: null },
    include: {
      department: true,
      designation: true,
      joining: { include: { offerLetter: true } },
    },
  });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  const joining = await prisma.candidateJoining.findUnique({
    where: { id: parsed.data.joiningId },
    include: { offerLetter: true },
  });
  if (!joining) return NextResponse.json({ error: 'Joining record not found' }, { status: 404 });

  // Check if already converted
  if (candidate.convertedEmployeeId) {
    return NextResponse.json({ error: 'Candidate already converted to employee' }, { status: 400 });
  }

  // Generate employee code
  const employeeCode = parsed.data.employeeCode || await generateEmployeeCode(candidate.department?.code);

  // Check for duplicate employee code
  const existing = await prisma.employee.findFirst({ where: { employeeCode, companyId: parsed.data.companyId } });
  if (existing) {
    return NextResponse.json({ error: `Employee code ${employeeCode} already exists` }, { status: 400 });
  }

  // Create Employee record with mapped fields
  const employee = await prisma.$transaction(async (tx) => {
    const emp = await tx.employee.create({
      data: {
        companyId: parsed.data.companyId,
        employeeCode,
        title: candidate.title,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        status: 'active',
        reportingManagerId: joining.offerLetter?.reportingManagerId ?? null,
        isActive: true,
      },
    });

    // Link candidate to employee
    await tx.candidate.update({
      where: { id: candidate.id },
      data: { convertedEmployeeId: emp.id },
    });

    // Update joining status to Joined
    await tx.candidateJoining.update({
      where: { id: joining.id },
      data: {
        joiningStatus: 'Joined',
        actualJoiningDate: joining.actualJoiningDate ?? new Date(),
      },
    });

    // BRD §7.8 — Copy Other Joining Documents to EmployeeDocument (KYC & Statutory → Document Upload)
    const otherDocs = await tx.candidateOtherDocument.findMany({
      where: { candidateId: candidate.id },
    });
    if (otherDocs.length > 0) {
      await tx.employeeDocument.createMany({
        data: otherDocs.map((d) => ({
          employeeId: emp.id,
          docType: 'other',
          docNumber: d.otherDocTypeId.toString(),
          fileName: d.fileName,
          filePath: d.filePath,
          isVerified: d.verificationStatus === 'Verified',
        })),
      });
    }

    // Log activity
    await tx.candidateActivityLog.create({
      data: {
        candidateId: candidate.id,
        action: `Converted to Employee — ${employeeCode}`,
        remarks: `Employee ID: ${emp.id}${otherDocs.length > 0 ? `, ${otherDocs.length} other documents copied to Employee Master` : ''}`,
      },
    });

    return emp;
  });

  // Update candidate status to JOINED
  const joinedStatus = await prisma.recruitmentStatus.findUnique({ where: { statusCode: 'JOINED' } });
  if (joinedStatus) {
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { currentStatusId: joinedStatus.id },
    });
  }

  return NextResponse.json({
    message: 'Candidate converted to employee',
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    employee,
  }, { status: 201 });
}
