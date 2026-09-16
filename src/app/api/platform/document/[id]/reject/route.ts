/**
 * POST /api/platform/document/[id]/reject — reject a claimed document (platform.document.verify).
 * Body: { reasonCode: ILLEGIBLE|WRONG_DOCUMENT|EXPIRED_AT_UPLOAD|DETAILS_MISMATCH|INCOMPLETE_PAGES|SUSPECTED_FORGERY|OTHER, remark (>= 10 chars) }
 */

import { NextRequest, NextResponse } from 'next/server';
import { pdocRejectSchema } from '@/lib/validations/platform-document';
import { rejectDocument } from '@/lib/platform/document/service';
import { documentErrorResponse, openDocumentRequest, parseId, readJsonBody } from '@/lib/platform/document/http';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const opened = await openDocumentRequest(request, 'platform.document.verify');
  if ('error' in opened) return opened.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = pdocRejectSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    return NextResponse.json(await rejectDocument(opened.ctx.companyId, id, opened.ctx.actor, parsed.data.reasonCode, parsed.data.remark));
  } catch (err) {
    return documentErrorResponse(err);
  }
}
