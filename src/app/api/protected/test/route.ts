/**
 * GET /api/protected/test
 *
 * Protected route — requires:
 * 1. Valid JWT (verified by middleware)
 * 2. Permission: system.test.demo.view (checked here in Node runtime)
 *
 * This is the ONE test route to prove RBAC works end-to-end.
 * Do NOT extend to other routes until Checkpoint 3 is approved.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  // Middleware already verified the JWT and set these headers
  const userId = request.headers.get('x-user-id');
  const roleId = request.headers.get('x-role-id');
  const roleCode = request.headers.get('x-role-code');

  if (!roleId) {
    return NextResponse.json(
      { error: 'Unauthorized — no role context' },
      { status: 401 }
    );
  }

  // Permission check (Node runtime — Prisma access)
  const allowed = await hasPermission(Number(roleId), {
    module: 'system',
    submodule: 'test',
    page: 'demo',
    action: 'view',
  });

  if (!allowed) {
    return NextResponse.json(
      {
        error: 'Forbidden — insufficient permissions',
        required: 'system.test.demo.view',
        roleId: Number(roleId),
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    message: 'RBAC skeleton works! You have access to this protected route.',
    user: {
      userId: Number(userId),
      roleId: Number(roleId),
      roleCode,
    },
    permission: 'system.test.demo.view',
  });
}
