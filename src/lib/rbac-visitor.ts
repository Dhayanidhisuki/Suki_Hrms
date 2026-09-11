/**
 * RBAC permission helper for Visitor module routes.
 *
 * All visitor actions are scoped under module: "visitor", submodule: "gate".
 */

import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from './rbac';

export type VisitorAction = 'view' | 'create' | 'edit' | 'cancel' | 'checkin' | 'checkout' | 'export' | 'approve' | 'reject';

/**
 * Check a visitor-gate permission on an API request.
 * Returns null if allowed, otherwise a 401/403 NextResponse.
 */
export async function checkVisitorPermission(
  request: NextRequest,
  action: VisitorAction
): Promise<NextResponse | null> {
  const roleId = request.headers.get('x-role-id');
  if (!roleId) {
    return NextResponse.json(
      { error: 'Unauthorized — authentication required' },
      { status: 401 }
    );
  }

  const allowed = await hasPermission(Number(roleId), {
    module: 'visitor',
    submodule: 'gate',
    action,
  });

  if (!allowed) {
    return NextResponse.json(
      {
        error: 'Forbidden — insufficient permissions',
        required: `visitor.gate.${action}`,
        roleId: Number(roleId),
      },
      { status: 403 }
    );
  }

  return null;
}
