/**
 * GET  /api/employees/[id]/documents — legacy EmployeeDocument rows (read-only).
 * POST — gone; new files must use POST /api/platform/document.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { annotateDocumentExpiry } from '@/lib/document-expiry';

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

export async function POST() {
  return NextResponse.json(
    {
      error: 'File uploads belong in the Document Module. Use the Documents tab or POST /api/platform/document.',
    },
    { status: 410 },
  );
}
