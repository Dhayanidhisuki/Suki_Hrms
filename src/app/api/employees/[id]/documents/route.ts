/**
 * POST   /api/employees/[id]/documents   — add a document to an employee
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { documentCreateSchema } from '@/lib/validations/employee';
import { annotateDocumentExpiry } from '@/lib/document-expiry';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const employeeId = parseInt(id);

  const body = await request.json();
  const parsed = documentCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { id: true },
  });

  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const doc = await prisma.employeeDocument.create({
    data: {
      employeeId,
      docType: parsed.data.docType,
      docNumber: parsed.data.docNumber ?? null,
      fileName: parsed.data.fileName ?? null,
      filePath: parsed.data.filePath ?? null,
      issuedDate: parsed.data.issuedDate ?? null,
      expiryDate: parsed.data.expiryDate ?? null,
      isVerified: parsed.data.isVerified,
    },
  });

  return NextResponse.json(annotateDocumentExpiry(doc), { status: 201 });
}
