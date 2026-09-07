/**
 * RBAC guard for Superadmin-only routes (/api/superadmin/**).
 *
 * Superadmin is a platform-level flag on User (isSuperAdmin), not an RBAC
 * role — it isn't tied to any company and has no Permission grants to check.
 * Call this at the top of each superadmin route handler, same pattern as
 * checkAdminPermission/checkMasterPermission.
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Returns null if the request is from an authenticated superadmin (proceed
 * with handler). Returns a 401/403 NextResponse otherwise.
 */
export async function requireSuperAdmin(
  request: NextRequest
): Promise<NextResponse | null> {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized — authentication required' },
      { status: 401 }
    );
  }

  if (request.headers.get('x-is-superadmin') !== 'true') {
    return NextResponse.json(
      { error: 'Forbidden — superadmin access required' },
      { status: 403 }
    );
  }

  return null;
}
