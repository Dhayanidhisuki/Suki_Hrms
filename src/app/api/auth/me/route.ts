/**
 * GET /api/auth/me
 *
 * Reads the identity headers proxy.ts injects from the verified JWT and
 * returns a small client-safe summary — used by the Sidebar to decide
 * whether to show the Administration / Superadmin nav sections. This is a
 * coarse check, not full permission data: hasAdminAccess just means "holds
 * any admin.* permission", not which ones.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasAnyPermission, hasAnyPermissionInModule } from '@/lib/rbac';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isSuperAdmin = request.headers.get('x-is-superadmin') === 'true';
  const roleId = request.headers.get('x-role-id');
  const roleCode = request.headers.get('x-role-code');
  const companyId = request.headers.get('x-company-id');

  const [hasAdminAccess, hasHrAccess, user, employeeId] = await Promise.all([
    isSuperAdmin
      ? Promise.resolve(false) // superadmin doesn't use the company-scoped Administration section
      : roleId
        ? hasAnyPermissionInModule(Number(roleId), 'admin')
        : Promise.resolve(false),
    // Holds ANY permission — i.e. this is an HR-side role, not an ESS-only
    // login. hasAdminAccess is narrower (admin.* only) and cannot stand in for
    // this: an HR Admin has no admin.* grant but still works the HR modules.
    isSuperAdmin
      ? Promise.resolve(false)
      : roleId
        ? hasAnyPermission(Number(roleId))
        : Promise.resolve(false),
    prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { email: true, company: { select: { name: true } } },
    }),
    resolveOwnEmployeeId(Number(userId)),
  ]);

  // Whether this login manages anyone. The manager approval stage is gated
  // on the org chart rather than RBAC, so a plain employee with reports still
  // needs the Approval Center in their nav — without this the only route to
  // their queue is the dashboard's "My approvals" tab.
  const isManager = employeeId
    ? (await prisma.employee.count({
        where: { reportingManagerId: employeeId, deletedAt: null, isActive: true },
      })) > 0
    : false;

  return NextResponse.json({
    userId: Number(userId),
    email: user?.email ?? null,
    isSuperAdmin,
    roleId: roleId ? Number(roleId) : null,
    roleCode: roleCode ?? null,
    companyId: companyId ? Number(companyId) : null,
    companyName: user?.company?.name ?? null,
    hasAdminAccess,
    hasHrAccess,
    hasEmployeeAccess: !!employeeId,
    isManager,
  });
}
