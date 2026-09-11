/**
 * GET /api/workforce/comp-off/balance?employeeId=X
 *   Returns the employee's current comp-off balance.
 * GET /api/workforce/comp-off/balance (no employeeId)
 *   Returns all employees' comp-off balances (admin view).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');

  if (employeeId) {
    const permErr = await checkSpecificPermission(request, 'workforce.attendance.view');
    if (permErr) return permErr;
    const balance = await prisma.compOffBalance.findUnique({
      where: { employeeId: Number(employeeId) },
      include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } },
    });
    return NextResponse.json(balance ?? {
      employeeId: Number(employeeId),
      balance: 0, earned: 0, used: 0, expired: 0, encashed: 0,
    });
  }

  // Admin view — all employees for this company.
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const balances = await prisma.compOffBalance.findMany({
    where: { employee: { companyId: scope.companyId, deletedAt: null } },
    include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } },
    orderBy: { employee: { employeeCode: 'asc' } },
  });

  return NextResponse.json({ data: balances });
}
