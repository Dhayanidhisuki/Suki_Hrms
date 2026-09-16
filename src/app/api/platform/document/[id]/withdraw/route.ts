/**
 * POST /api/platform/document/[id]/withdraw — owner withdraws an Uploaded document (platform.document.upload).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withdrawDocument } from '@/lib/platform/document/service';
import { documentErrorResponse, openDocumentRequest, parseId } from '@/lib/platform/document/http';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const opened = await openDocumentRequest(request, 'platform.document.upload');
  if ('error' in opened) return opened.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  try {
    return NextResponse.json(await withdrawDocument(opened.ctx.companyId, id, opened.ctx.actor));
  } catch (err) {
    return documentErrorResponse(err);
  }
}
