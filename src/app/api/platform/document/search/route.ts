/**
 * GET /api/platform/document/search
 *      q, businessCategory, verificationStatus, documentTypeCode, includeSuperseded, page, limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { pdocSearchQuerySchema } from '@/lib/validations/platform-document';
import { searchDocuments } from '@/lib/platform/document/service';
import { documentErrorResponse, openDocumentRequest } from '@/lib/platform/document/http';
import { isBusinessCategory } from '@/lib/platform/document/categories';

export async function GET(request: NextRequest) {
  const opened = await openDocumentRequest(request, 'platform.document.view');
  if ('error' in opened) return opened.error;

  const sp = request.nextUrl.searchParams;
  const parsed = pdocSearchQuerySchema.safeParse({
    q: sp.get('q') || undefined,
    businessCategory: sp.get('businessCategory') || undefined,
    verificationStatus: sp.get('verificationStatus') || undefined,
    documentTypeCode: sp.get('documentTypeCode') || undefined,
    includeSuperseded: sp.get('includeSuperseded') === '1' ? '1' : undefined,
    expiry: sp.get('expiry') || undefined,
    page: sp.get('page') ?? undefined,
    limit: sp.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.businessCategory && !isBusinessCategory(parsed.data.businessCategory)) {
    return NextResponse.json({ error: 'Unknown business category' }, { status: 400 });
  }

  try {
    const result = await searchDocuments(opened.ctx.companyId, opened.ctx.caller, {
      ...parsed.data,
      includeSuperseded: parsed.data.includeSuperseded === '1',
    });
    return NextResponse.json(result);
  } catch (err) {
    return documentErrorResponse(err);
  }
}
