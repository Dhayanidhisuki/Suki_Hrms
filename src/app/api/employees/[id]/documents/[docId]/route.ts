/**
 * DELETE /api/employees/[id]/documents/[docId] — remove a document from an employee
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await params;
  const employeeId = parseInt(id);
  const documentId = parseInt(docId);

  const doc = await prisma.employeeDocument.findFirst({
    where: { id: documentId, employeeId },
  });

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  await prisma.employeeDocument.delete({
    where: { id: documentId },
  });

  return NextResponse.json({ message: 'Document deleted' }, { status: 200 });
}
