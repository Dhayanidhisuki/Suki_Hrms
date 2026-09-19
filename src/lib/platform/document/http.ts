/**
 * Route-handler glue for /api/platform/document/**: permission → company
 * scope → actor, plus a uniform mapping of DocumentError to JSON responses
 * so no Prisma error ever leaks as a 500 body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { DocumentError } from './rules';
import { resolveDocumentActor, type ResolvedActor } from './actor';

export type DocumentRequestContext = ResolvedActor & { companyId: number };

/** Returns a NextResponse to short-circuit with, or the resolved context. */
export async function openDocumentRequest(
  request: NextRequest,
  permissionCode: string,
): Promise<{ error: NextResponse } | { ctx: DocumentRequestContext }> {
  const permErr = await checkSpecificPermission(request, permissionCode);
  if (permErr) return { error: permErr };
  const scope = getCompanyId(request);
  if ('error' in scope) return { error: scope.error };
  const resolved = await resolveDocumentActor(request, scope.companyId);
  return { ctx: { companyId: scope.companyId, ...resolved } };
}

/**
 * Auth-only resolve (no RBAC permission check). Every self-service route
 * in this file calls this first, then decides — once it knows who the
 * document/upload target actually is — whether to additionally require an
 * HR-level RBAC permission via checkSpecificPermission (imported directly
 * from '@/lib/rbac-employee' by each route), matching the self-service
 * convention every other ESS endpoint in this codebase uses
 * (workforce/permission, my-payslips, my-attendance, tds-declaration): a
 * caller acting on their own employee record never needs the grant; acting
 * on someone else's does.
 */
export async function resolveDocumentContext(
  request: NextRequest,
): Promise<{ error: NextResponse } | { ctx: DocumentRequestContext }> {
  const scope = getCompanyId(request);
  if ('error' in scope) return { error: scope.error };
  const resolved = await resolveDocumentActor(request, scope.companyId);
  if (!resolved.actor.userId) {
    return { error: NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 }) };
  }
  return { ctx: { companyId: scope.companyId, ...resolved } };
}

export function documentErrorResponse(err: unknown): NextResponse {
  if (err instanceof DocumentError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error('[platform/document] unexpected error:', err);
  return NextResponse.json({ error: 'Document operation failed' }, { status: 500 });
}

export function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function readJsonBody(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => ({}));
}
