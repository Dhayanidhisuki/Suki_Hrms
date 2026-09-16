/**
 * GET /api/platform/document/completeness?ownerEntityType=EMPLOYEE&ownerEntityId=12[&stage=JOINING]
 *     — §16.4 completeness over the mandatory types (platform.document.view).
 */

import { NextRequest, NextResponse } from 'next/server';
import { pdocCompletenessQuerySchema } from '@/lib/validations/platform-document';
import { completeness } from '@/lib/platform/document/service';
import { documentErrorResponse, openDocumentRequest } from '@/lib/platform/document/http';

export async function GET(request: NextRequest) {
  const opened = await openDocumentRequest(request, 'platform.document.view');
  if ('error' in opened) return opened.error;

  const sp = request.nextUrl.searchParams;
  const parsed = pdocCompletenessQuerySchema.safeParse({
    ownerEntityType: sp.get('ownerEntityType')?.toUpperCase(),
    ownerEntityId: sp.get('ownerEntityId'),
    stage: sp.get('stage') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const { stage, ...owner } = parsed.data;
    return NextResponse.json(await completeness(opened.ctx.companyId, owner, stage));
  } catch (err) {
    return documentErrorResponse(err);
  }
}
