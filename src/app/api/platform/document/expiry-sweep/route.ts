/**
 * POST /api/platform/document/expiry-sweep — run the §17.1 expiry sweep for this company now
 *      (platform.document.admin). Body: { today?: 'YYYY-MM-DD' } for back-dated runs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pdocExpirySweepSchema } from '@/lib/validations/platform-document';
import { runExpirySweep } from '@/lib/platform/document/service';
import { documentErrorResponse, openDocumentRequest, readJsonBody } from '@/lib/platform/document/http';

export async function POST(request: NextRequest) {
  const opened = await openDocumentRequest(request, 'platform.document.admin');
  if ('error' in opened) return opened.error;

  const parsed = pdocExpirySweepSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const today = parsed.data.today ? new Date(`${parsed.data.today}T00:00:00Z`) : undefined;
    return NextResponse.json(await runExpirySweep(opened.ctx.companyId, today));
  } catch (err) {
    return documentErrorResponse(err);
  }
}
