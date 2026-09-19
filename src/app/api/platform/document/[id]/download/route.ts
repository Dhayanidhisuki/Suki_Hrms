/**
 * GET /api/platform/document/[id]/download — file bytes (platform.document.view, access-checked per §17.3).
 * RESTRICTED documents are never served to managers; any denial is a 404.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { canAccessDocument, getDocument, readDocumentBytes } from '@/lib/platform/document/service';
import { documentErrorResponse, parseId, resolveDocumentContext } from '@/lib/platform/document/http';

function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const opened = await resolveDocumentContext(request);
  if ('error' in opened) return opened.error;
  const { companyId, caller, actor } = opened.ctx;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  try {
    const meta = await getDocument(companyId, id);
    // Downloading your own document never needs the HR-level
    // platform.document.view grant (self-service convention).
    const isSelf = meta.ownerEntityType === 'EMPLOYEE' && caller.employeeId != null && caller.employeeId === meta.ownerEntityId;
    if (!isSelf) {
      const permErr = await checkSpecificPermission(request, 'platform.document.view');
      if (permErr) return permErr;
    }
    if (!(await canAccessDocument(companyId, meta, caller))) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    const { view, bytes } = await readDocumentBytes(companyId, id, actor);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': view.mimeType,
        'Content-Length': String(bytes.length),
        'Content-Disposition': contentDisposition(view.originalFileName),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    return documentErrorResponse(err);
  }
}
