/**
 * DELETE /api/employees/[id]/ctc/components/[componentRowId] — remove one
 *        NON_PAYROLL component row from the employee's current CTC revision.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; componentRowId: string }> }) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id, componentRowId } = await params;
  const employeeId = parseInt(id);

  const current = await prisma.employeeCtc.findFirst({ where: { employeeId, effectiveTo: null } });
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const row = await prisma.employeeCtcComponent.findFirst({
    where: { id: parseInt(componentRowId), employeeCtcId: current.id },
  });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.employeeCtcComponent.delete({ where: { id: row.id } });
  return NextResponse.json({ message: 'Deleted' });
}
