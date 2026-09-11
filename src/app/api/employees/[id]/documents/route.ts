/**
 * GET    /api/employees/[id]/documents   — list an employee's documents
 * POST   /api/employees/[id]/documents   — upload a document (multipart).
 *        Body: multipart/form-data with fields:
 *          - file (required): the file, allowed jpg/jpeg/png/webp/pdf
 *          - docType (required): aadhaar | pan | passport | driving_license | kpi | jd | signature | government | other
 *          - docNumber (optional)
 *          - issuedDate (optional)
 *          - expiryDate (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { documentCreateSchema } from '@/lib/validations/employee';
import { saveUploadedFile } from '@/lib/file-storage';
import { annotateDocumentExpiry } from '@/lib/document-expiry';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const employeeId = parseInt(id);

  const docs = await prisma.employeeDocument.findMany({
    where: { employeeId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data: docs.map(annotateDocumentExpiry) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const employeeId = parseInt(id);

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded (expected multipart field "file")' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Uploaded file is empty' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large — maximum 5 MB' }, { status: 400 });
  }

  const docType = String(form?.get('docType') ?? 'other');
  const docNumber = String(form?.get('docNumber') ?? '') || null;
  const issuedDateRaw = String(form?.get('issuedDate') ?? '');
  const expiryDateRaw = String(form?.get('expiryDate') ?? '');

  const parsed = documentCreateSchema.safeParse({
    docType,
    docNumber,
    fileName: file.name,
    filePath: null,
    issuedDate: issuedDateRaw ? new Date(issuedDateRaw) : null,
    expiryDate: expiryDateRaw ? new Date(expiryDateRaw) : null,
    isVerified: false,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const relativePath = await saveUploadedFile(buffer, `employees/${employeeId}/documents`, file.name);
    const filePath = `/api/uploads/${relativePath}`;

    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId,
        docType: parsed.data.docType,
        docNumber: parsed.data.docNumber,
        fileName: file.name,
        filePath,
        issuedDate: parsed.data.issuedDate,
        expiryDate: parsed.data.expiryDate,
        isVerified: parsed.data.isVerified,
      },
    });

    return NextResponse.json(annotateDocumentExpiry(doc), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 400 });
  }
}
