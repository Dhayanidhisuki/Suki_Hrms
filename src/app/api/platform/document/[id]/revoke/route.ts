/**
 * POST /api/platform/document/[id]/revoke — HR Manager revokes a verification (platform.document.admin). Body: { reason }
 */

import { NextRequest, NextResponse } from 'next/server';
import { pdocRevokeSchema } from '@/lib/validations/platform-document';
import { revokeVerification } from '@/lib/platform/document/service';
import { documentErrorResponse, openDocumentRequest, parseId, readJsonBody } from '@/lib/platform/document/http';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const opened = await openDocumentRequest(request, 'platform.document.admin');
  if ('error' in opened) return opened.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = pdocRevokeSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    return NextResponse.json(await revokeVerification(opened.ctx.companyId, id, opened.ctx.actor, parsed.data.reason));
  } catch (err) {
    return documentErrorResponse(err);
  }
}
