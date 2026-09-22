/**
 * POST /api/platform/document/[id]/request-resubmission — ask the owner for a
 * fresh copy without rejecting the document (platform.document.verify).
 *
 * The BRD's third review verdict, alongside verify and reject.
 * Body: { remark (>= 10 chars) }
 */

import { NextRequest, NextResponse } from 'next/server';
import { pdocResubmissionSchema } from '@/lib/validations/platform-document';
import { requestResubmission } from '@/lib/platform/document/service';
import { documentErrorResponse, openDocumentRequest, parseId, readJsonBody } from '@/lib/platform/document/http';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const opened = await openDocumentRequest(request, 'platform.document.verify');
  if ('error' in opened) return opened.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = pdocResubmissionSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    return NextResponse.json(await requestResubmission(opened.ctx.companyId, id, opened.ctx.actor, parsed.data.remark));
  } catch (err) {
    return documentErrorResponse(err);
  }
}
