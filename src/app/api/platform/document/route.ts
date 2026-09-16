/**
 * GET  /api/platform/document?ownerEntityType=EMPLOYEE&ownerEntityId=12[&includeSuperseded=1]
 *      — list an owner's documents, newest first (platform.document.view; access-filtered per §17.3)
 * POST /api/platform/document — multipart upload (platform.document.upload)
 *      fields: file, documentTypeCode, ownerEntityType, ownerEntityId, issueDate?, expiryDate?, identifier?
 *      An employee may upload for themselves; HR roles for anyone in the company.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pdocOwnerQuerySchema, pdocUploadFieldsSchema } from '@/lib/validations/platform-document';
import { canAccessDocument, listDocuments, uploadDocument } from '@/lib/platform/document/service';
import { HR_MANAGER_ROLE_CODES } from '@/lib/platform/document/rules';
import { documentErrorResponse, openDocumentRequest } from '@/lib/platform/document/http';

export async function GET(request: NextRequest) {
  const opened = await openDocumentRequest(request, 'platform.document.view');
  if ('error' in opened) return opened.error;
  const { companyId, caller } = opened.ctx;

  const sp = request.nextUrl.searchParams;
  const parsed = pdocOwnerQuerySchema.safeParse({
    ownerEntityType: sp.get('ownerEntityType')?.toUpperCase(),
    ownerEntityId: sp.get('ownerEntityId'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const all = await listDocuments(companyId, parsed.data, { includeSuperseded: sp.get('includeSuperseded') === '1' });
    const data = [];
    for (const v of all) if (await canAccessDocument(companyId, v, caller)) data.push(v);
    return NextResponse.json({ data });
  } catch (err) {
    return documentErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  const opened = await openDocumentRequest(request, 'platform.document.upload');
  if ('error' in opened) return opened.error;
  const { companyId, actor, caller } = opened.ctx;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  const file = form.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded (expected multipart field "file")' }, { status: 400 });
  }

  const text = (k: string) => {
    const v = form.get(k);
    return typeof v === 'string' && v.trim() !== '' ? v : undefined;
  };
  const parsed = pdocUploadFieldsSchema.safeParse({
    documentTypeCode: text('documentTypeCode'),
    ownerEntityType: text('ownerEntityType')?.toUpperCase(),
    ownerEntityId: text('ownerEntityId'),
    issueDate: text('issueDate'),
    expiryDate: text('expiryDate'),
    identifier: text('identifier'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // §15.4 step 1 — authorise: self-upload, or an HR role uploading for anyone in the company.
  const isHr = !!caller.roleCode && HR_MANAGER_ROLE_CODES.includes(caller.roleCode);
  const isSelf = parsed.data.ownerEntityType === 'EMPLOYEE' && caller.employeeId != null && caller.employeeId === parsed.data.ownerEntityId;
  if (!isHr && !isSelf) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const view = await uploadDocument({
      companyId,
      documentTypeCode: parsed.data.documentTypeCode,
      ownerEntityType: parsed.data.ownerEntityType,
      ownerEntityId: parsed.data.ownerEntityId,
      file: { name: file.name, mimeType: file.type, bytes },
      issueDate: parsed.data.issueDate,
      expiryDate: parsed.data.expiryDate,
      identifier: parsed.data.identifier,
      actor,
    });
    return NextResponse.json(view, { status: 201 });
  } catch (err) {
    return documentErrorResponse(err);
  }
}
