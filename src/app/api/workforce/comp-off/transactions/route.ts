/**
 * GET /api/workforce/comp-off/transactions?employeeId=X
 *   Returns the employee's comp-off transaction history.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.view');
  if (permErr) return permErr;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
  }

  const limit = parseInt(searchParams.get('limit') ?? '50');
  const offset = parseInt(searchParams.get('offset') ?? '0');
  const type = searchParams.get('type');

  const where: Record<string, unknown> = { employeeId: Number(employeeId) };
  if (type) where.type = type;

  const [data, total] = await Promise.all([
    prisma.compOffTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.compOffTransaction.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { limit, offset, total } });
}
