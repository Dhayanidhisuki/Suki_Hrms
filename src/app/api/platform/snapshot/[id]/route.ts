/**
 * GET /api/platform/snapshot/[id]           — read a snapshot (platform.document.view)
 * GET /api/platform/snapshot/[id]?verify=1  — also recompute the hash: { verify: 'INTACT' | 'DIVERGENT' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { readSnapshot, verifySnapshot } from '@/lib/platform/snapshot/service';
import { errorResponse, parseId } from '@/lib/platform/workflow/http';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'platform.document.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  try {
    const snap = await readSnapshot(scope.companyId, id);
    if (!snap) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (request.nextUrl.searchParams.get('verify') === '1') {
      const verify = await verifySnapshot(scope.companyId, id);
      return NextResponse.json({ ...snap, verify });
    }
    return NextResponse.json(snap);
  } catch (err) {
    return errorResponse(err);
  }
}
