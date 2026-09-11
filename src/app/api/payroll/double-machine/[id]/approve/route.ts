import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.manage');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const entryId = parseInt(id);
  const userId = Number(request.headers.get('x-user-id'));
  const entry = await prisma.doubleMachineEntry.findUnique({ where: { id: entryId } });
  if (!entry || !(await findEmployeeInCompany(entry.employeeId, scope.companyId))) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }
  if (entry.status !== 'PENDING') return NextResponse.json({ error: `Entry is already ${entry.status}` }, { status: 409 });
  const updated = await prisma.doubleMachineEntry.update({
    where: { id: entryId },
    data: { status: 'APPROVED', approvedByUserId: userId, approvedAt: new Date() },
  });
  return NextResponse.json(updated);
}
