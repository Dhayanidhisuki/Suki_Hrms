/**
 * GET /api/admin/permissions   — list the full permission catalog, sorted by
 *                                 module/submodule/action. Read-only — the
 *                                 catalog is defined by the seed script
 *                                 (POST /api/auth/seed), not editable via API.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAdminPermission } from '@/lib/rbac-admin';

export async function GET(request: NextRequest) {
  const permErr = await checkAdminPermission(request);
  if (permErr) return permErr;

  const data = await prisma.permission.findMany({
    where: { deletedAt: null },
    orderBy: [{ module: 'asc' }, { submodule: 'asc' }, { action: 'asc' }],
  });

  return NextResponse.json(data);
}
