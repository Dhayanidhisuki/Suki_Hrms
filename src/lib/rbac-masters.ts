/**
 * RBAC permission helper for Master Setup routes.
 *
 * Maps master API routes to permission groups (org, statutory, shift,
 * dropdown, definition) and provides a single check function that
 * route handlers call at the top.
 */

import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from './rbac';

type MasterGroup = 'org' | 'statutory' | 'shift' | 'dropdown' | 'definition';

/**
 * Map API path prefix → master group.
 */
const PATH_TO_GROUP: Record<string, MasterGroup> = {
  '/api/masters/companies': 'org',
  '/api/masters/departments': 'org',
  '/api/masters/sub-departments': 'org',
  '/api/masters/designations': 'org',
  '/api/masters/employee-types': 'org',
  '/api/masters/categories': 'org',
  '/api/masters/units': 'org',
  '/api/masters/grades': 'org',
  '/api/masters/levels': 'org',
  '/api/masters/tds-slabs': 'statutory',
  '/api/masters/professional-tax-slabs': 'statutory',
  '/api/masters/esi-rates': 'statutory',
  '/api/masters/pf-rates': 'statutory',
  '/api/masters/salary-components': 'statutory',
  '/api/masters/shift-masters': 'shift',
  '/api/masters/shift-plans': 'shift',
  '/api/masters/ot-plans': 'shift',
  '/api/masters/dropdown-master': 'dropdown',
  '/api/masters/leave-masters': 'definition',
  '/api/masters/loan-types': 'definition',
  '/api/masters/asset-masters': 'definition',
};

/**
 * Resolve which master group a request path belongs to.
 * Returns null if the path is not a master route.
 */
function resolveGroup(pathname: string): MasterGroup | null {
  // Strip trailing [id] segment — match by prefix
  for (const prefix of Object.keys(PATH_TO_GROUP)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return PATH_TO_GROUP[prefix];
    }
  }
  return null;
}

/**
 * Check master permission on an API request.
 * Call this at the top of each route handler.
 *
 * - GET → action "view"
 * - POST/PUT/DELETE → action "edit"
 *
 * Returns null if allowed (proceed with handler).
 * Returns a 403 NextResponse if forbidden.
 * Returns a 401 NextResponse if no role context (not authenticated).
 */
export async function checkMasterPermission(
  request: NextRequest
): Promise<NextResponse | null> {
  const roleId = request.headers.get('x-role-id');
  if (!roleId) {
    return NextResponse.json(
      { error: 'Unauthorized — authentication required' },
      { status: 401 }
    );
  }

  const group = resolveGroup(request.nextUrl.pathname);
  if (!group) {
    // Not a master route — allow (shouldn't happen if wired correctly)
    return null;
  }

  const method = request.method.toUpperCase();
  const action = method === 'GET' ? 'view' : 'edit';

  const allowed = await hasPermission(Number(roleId), {
    module: 'masters',
    submodule: group,
    action,
  });

  if (!allowed) {
    return NextResponse.json(
      {
        error: 'Forbidden — insufficient permissions',
        required: `masters.${group}.${action}`,
        roleId: Number(roleId),
      },
      { status: 403 }
    );
  }

  return null;
}
