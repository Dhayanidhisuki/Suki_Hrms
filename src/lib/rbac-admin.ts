/**
 * RBAC permission helper for Administration > User & Access routes.
 *
 * Maps API path prefixes to permission submodules (users, roles,
 * permissions) under the "admin" module and provides a single check
 * function that route handlers call at the top — same pattern as
 * checkMasterPermission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from './rbac';

type AdminGroup = 'users' | 'roles' | 'permissions';

/**
 * Map API path prefix → admin group.
 * '/api/admin/roles' also covers nested routes like
 * '/api/admin/roles/[id]/permissions' since matching is by prefix.
 */
const PATH_TO_GROUP: Record<string, AdminGroup> = {
  '/api/admin/users': 'users',
  '/api/admin/roles': 'roles',
  '/api/admin/permissions': 'permissions',
};

/**
 * Resolve which admin group a request path belongs to.
 * Returns null if the path is not an admin route this helper governs.
 */
function resolveGroup(pathname: string): AdminGroup | null {
  for (const prefix of Object.keys(PATH_TO_GROUP)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return PATH_TO_GROUP[prefix];
    }
  }
  return null;
}

/**
 * Check admin permission on an API request.
 * Call this at the top of each route handler.
 *
 * - GET → action "view"
 * - POST/PUT/DELETE → action "edit"
 *
 * Returns null if allowed (proceed with handler).
 * Returns a 403 NextResponse if forbidden.
 * Returns a 401 NextResponse if no role context (not authenticated).
 */
export async function checkAdminPermission(
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
    // Not an admin route — allow (shouldn't happen if wired correctly)
    return null;
  }

  const method = request.method.toUpperCase();
  const action = method === 'GET' ? 'view' : 'edit';

  const allowed = await hasPermission(Number(roleId), {
    module: 'admin',
    submodule: group,
    action,
  });

  if (!allowed) {
    return NextResponse.json(
      {
        error: 'Forbidden — insufficient permissions',
        required: `admin.${group}.${action}`,
        roleId: Number(roleId),
      },
      { status: 403 }
    );
  }

  return null;
}
