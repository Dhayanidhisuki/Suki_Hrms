/**
 * POST /api/platform/document/[id]/claim — verifier picks up an Uploaded document (platform.document.verify).
 */

import { NextRequest, NextResponse } from 'next/server';
import { claimForVerification } from '@/lib/platform/document/service';
import { documentErrorResponse, openDocumentRequest, parseId } from '@/lib/platform/document/http';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const opened = await openDocumentRequest(request, 'platform.document.verify');
  if ('error' in opened) return opened.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  try {
    return NextResponse.json(await claimForVerification(opened.ctx.companyId, id, opened.ctx.actor));
  } catch (err) {
    return documentErrorResponse(err);
  }
}
