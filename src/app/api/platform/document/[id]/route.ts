/**
 * GET /api/platform/document/[id] — document metadata (platform.document.view, access-checked; 404 on denial)
 */

import { NextRequest, NextResponse } from 'next/server';
import { canAccessDocument, getDocument } from '@/lib/platform/document/service';
import { documentErrorResponse, openDocumentRequest, parseId } from '@/lib/platform/document/http';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const opened = await openDocumentRequest(request, 'platform.document.view');
  if ('error' in opened) return opened.error;
  const { companyId, caller } = opened.ctx;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  try {
    const view = await getDocument(companyId, id);
    if (!(await canAccessDocument(companyId, view, caller))) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    return NextResponse.json(view);
  } catch (err) {
    return documentErrorResponse(err);
  }
}
