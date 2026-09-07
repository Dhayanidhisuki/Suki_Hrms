/**
 * GET /api/admin/permissions   — list the full permission catalog, sorted by
 *                                 module/submodule/action. Read-only, and
 *                                 shared across all companies (only the
 *                                 grants — which role has which permission —
 *                                 are company-scoped). The catalog itself is
 *                                 upserted by
 *                                 POST /api/superadmin/companies/[id]/bootstrap-admin,
 *                                 not editable via this API.
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
