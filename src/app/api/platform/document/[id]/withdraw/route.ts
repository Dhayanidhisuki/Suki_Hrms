/**
 * POST /api/platform/document/[id]/withdraw — owner withdraws an Uploaded document (platform.document.upload).
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getDocument, withdrawDocument } from '@/lib/platform/document/service';
import { documentErrorResponse, parseId, resolveDocumentContext } from '@/lib/platform/document/http';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const opened = await resolveDocumentContext(request);
  if ('error' in opened) return opened.error;
  const { companyId, actor, caller } = opened.ctx;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  try {
    // withdrawDocument itself enforces "only the owner may withdraw it", so
    // this is always self by construction — no RBAC grant needed. Kept as
    // an explicit check (rather than relying solely on the service) so a
    // future change there can't silently reopen this to non-owners.
    const meta = await getDocument(companyId, id);
    const isSelf = meta.ownerEntityType === 'EMPLOYEE' && caller.employeeId != null && caller.employeeId === meta.ownerEntityId;
    if (!isSelf) {
      const permErr = await checkSpecificPermission(request, 'platform.document.upload');
      if (permErr) return permErr;
    }
    return NextResponse.json(await withdrawDocument(companyId, id, actor));
  } catch (err) {
    return documentErrorResponse(err);
  }
}
