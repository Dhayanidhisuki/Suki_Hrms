/**
 * GET /api/platform/document/[id]/versions — every version of the same owner+type, newest first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { canAccessDocument, listDocumentVersions } from '@/lib/platform/document/service';
import { documentErrorResponse, openDocumentRequest, parseId } from '@/lib/platform/document/http';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const opened = await openDocumentRequest(request, 'platform.document.view');
  if ('error' in opened) return opened.error;
  const { companyId, caller } = opened.ctx;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  try {
    const versions = await listDocumentVersions(companyId, id);
    const data = [];
    for (const v of versions) if (await canAccessDocument(companyId, v, caller)) data.push(v);
    if (data.length === 0) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    return documentErrorResponse(err);
  }
}
