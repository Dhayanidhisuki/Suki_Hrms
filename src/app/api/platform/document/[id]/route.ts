/**
 * GET /api/platform/document/[id] — document metadata (platform.document.view, access-checked; 404 on denial)
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { canAccessDocument, getDocument } from '@/lib/platform/document/service';
import { documentErrorResponse, parseId, resolveDocumentContext } from '@/lib/platform/document/http';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const opened = await resolveDocumentContext(request);
  if ('error' in opened) return opened.error;
  const { companyId, caller } = opened.ctx;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  try {
    const view = await getDocument(companyId, id);
    // Viewing your own document never needs the HR-level
    // platform.document.view grant (self-service convention).
    const isSelf = view.ownerEntityType === 'EMPLOYEE' && caller.employeeId != null && caller.employeeId === view.ownerEntityId;
    if (!isSelf) {
      const permErr = await checkSpecificPermission(request, 'platform.document.view');
      if (permErr) return permErr;
    }
    if (!(await canAccessDocument(companyId, view, caller))) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    return NextResponse.json(view);
  } catch (err) {
    return documentErrorResponse(err);
  }
}
