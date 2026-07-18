/**
 * GET    /api/employees/[id]   — get single employee with all relations
 * PUT    /api/employees/[id]   — update employee core fields
 * DELETE /api/employees/[id]   — soft-delete employee
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { employeeUpdateSchema } from '@/lib/validations/employee';
import { annotateDocumentExpiry, summarizeExpiry } from '@/lib/document-expiry';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const employee = await prisma.employee.findFirst({
    where: { id: parseInt(id), deletedAt: null },
    include: {
      personalDetails: true,
      jobInfos: {
        include: {
          department: true,
          subDepartment: true,
          designation: true,
          employeeType: true,
          category: true,
          grade: true,
          level: true,
          unit: true,
          shiftMaster: true,
          shiftPlan: true,
        },
        orderBy: { effectiveFrom: 'desc' },
      },
      salaryStructures: {
        orderBy: { effectiveFrom: 'desc' },
      },
      bankDetail: true,
      dependents: true,
      experiences: { orderBy: { fromDate: 'desc' } },
      educations: true,
      documents: true,
      assetAllocations: {
        where: { returnedDate: null },
        include: { assetMaster: true },
      },
      exitInterview: true,
      reportingManager: {
        select: { id: true, firstName: true, lastName: true, employeeCode: true },
      },
      directReports: {
        select: { id: true, firstName: true, lastName: true, employeeCode: true },
      },
    },
  });

  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const annotatedDocuments = employee.documents.map(annotateDocumentExpiry);
  const documentExpirySummary = summarizeExpiry(employee.documents);

  return NextResponse.json({
    ...employee,
    documents: annotatedDocuments,
    documentExpirySummary,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = employeeUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const employee = await prisma.employee.update({
    where: { id: parseInt(id) },
    data: parsed.data,
  });

  return NextResponse.json(employee);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const employeeId = parseInt(id);

  // Soft-delete: set deletedAt and isActive=false
  await prisma.employee.update({
    where: { id: employeeId },
    data: { deletedAt: new Date(), isActive: false },
  });

  return NextResponse.json({ message: 'Employee soft-deleted' }, { status: 200 });
}
