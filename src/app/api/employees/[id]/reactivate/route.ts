/**
 * POST /api/employees/[id]/reactivate — reverse a Deactivate. Gated by the
 * same employee.deactivate permission (reactivating is the same administrative
 * action in reverse, not a lesser one).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { logActivity } from '@/lib/activity-log';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'employee.deactivate');
  if (permErr) return permErr;

  const { id } = await params;
  const employeeId = parseInt(id);
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const employee = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null }, select: { isActive: true } });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  if (employee.isActive) return NextResponse.json({ error: 'Employee is already active' }, { status: 409 });

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: employeeId }, data: { isActive: true } });
    await logActivity(tx, {
      employeeId,
      activityType: 'reactivated',
      module: 'basic',
      performedByUserId,
      remarks: 'Employee reactivated',
    });
  });

  return NextResponse.json({ message: 'Employee reactivated' }, { status: 200 });
}
