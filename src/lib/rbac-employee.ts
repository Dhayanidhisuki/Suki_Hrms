/**
 * RBAC permission helper for Employee Master + Company routes.
 *
 * Maps API path prefixes to permission codes from the spec (employee.view,
 * employee.create, employee.edit, employee.salary.view/edit, employee.kyc.view/edit,
 * employee.document.view/edit, employee.activity.view, employee.asset.allocate,
 * employee.deactivate, employee.export).
 * Call at the top of each route handler, same pattern as checkMasterPermission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from './rbac';

/**
 * Path → permission-code resolver, checked in order (most specific first).
 * /api/employees/[id]/kyc and /api/employees/[id]/salary are nested under
 * the employee id segment, so they need a segment-aware match rather than a
 * plain prefix — a plain '/api/employees/kyc' prefix would never match
 * '/api/employees/5/kyc' and silently fall through to the generic codes.
 */
const PATH_RULES: Array<{ test: (pathname: string) => boolean; codes: { view: string; edit: string } }> = [
  {
    test: (p) => p === '/api/employees/activity' || p.startsWith('/api/employees/activity/') || p.startsWith('/api/employees/activity?'),
    codes: { view: 'employee.activity.view', edit: 'employee.activity.view' },
  },
  {
    test: (p) => /^\/api\/employees\/[^/]+\/kyc(\/|\?|$)/.test(p),
    codes: { view: 'employee.kyc.view', edit: 'employee.kyc.edit' },
  },
  {
    test: (p) => /^\/api\/employees\/[^/]+\/salary(\/|\?|$)/.test(p),
    codes: { view: 'employee.salary.view', edit: 'employee.salary.edit' },
  },
  {
    test: (p) => /^\/api\/employees\/[^/]+\/documents(\/|\?|$)/.test(p),
    codes: { view: 'employee.document.view', edit: 'employee.document.edit' },
  },
  {
    test: (p) => p === '/api/employees' || p.startsWith('/api/employees/') || p.startsWith('/api/employees?'),
    codes: { view: 'employee.view', edit: 'employee.edit' },
  },
  {
    test: (p) => p === '/api/uploads' || p.startsWith('/api/uploads/'),
    codes: { view: 'employee.view', edit: 'employee.edit' },
  },
];

function resolveCodes(pathname: string): { view: string; edit: string } | null {
  for (const rule of PATH_RULES) {
    if (rule.test(pathname)) return rule.codes;
  }
  return null;
}

/**
 * Check employee/company permission on an API request.
 *
 * - GET → view code
 * - POST/PUT/PATCH/DELETE → edit code (callers needing a finer-grained action,
 *   e.g. employee.create vs employee.edit, should also check explicitly)
 *
 * Returns null if allowed (proceed with handler).
 * Returns a 401/403 NextResponse otherwise.
 */
export async function checkEmployeePermission(request: NextRequest): Promise<NextResponse | null> {
  const roleId = request.headers.get('x-role-id');
  if (!roleId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const codes = resolveCodes(request.nextUrl.pathname);
  if (!codes) return null; // not a route this helper governs

  const method = request.method.toUpperCase();
  const requiredCode = method === 'GET' ? codes.view : codes.edit;
  const [module, ...rest] = requiredCode.split('.');
  const action = rest[rest.length - 1];
  const submodule = rest.slice(0, -1).join('.') || undefined;

  const allowed = await hasPermission(Number(roleId), { module, submodule, action });

  if (!allowed) {
    return NextResponse.json(
      { error: 'Forbidden — insufficient permissions', required: requiredCode, roleId: Number(roleId) },
      { status: 403 }
    );
  }

  return null;
}

/** Check one specific permission code directly (for create/deactivate/export actions). */
export async function checkSpecificPermission(
  request: NextRequest,
  code: string
): Promise<NextResponse | null> {
  const roleId = request.headers.get('x-role-id');
  if (!roleId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const [module, ...rest] = code.split('.');
  const action = rest[rest.length - 1];
  const submodule = rest.slice(0, -1).join('.') || undefined;

  const allowed = await hasPermission(Number(roleId), { module, submodule, action });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Forbidden — insufficient permissions', required: code, roleId: Number(roleId) },
      { status: 403 }
    );
  }
  return null;
}
