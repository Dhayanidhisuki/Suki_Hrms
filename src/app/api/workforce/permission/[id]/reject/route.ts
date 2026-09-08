/**
 * POST /api/workforce/permission/[id]/reject  { rejectionReason }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { permissionRejectSchema } from '@/lib/validations/workforce';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'workforce.permission.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = permissionRejectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const requestId = Number(id);
  const record = await prisma.permissionRequest.findUnique({ where: { id: requestId } });
  if (!record || !(await findEmployeeInCompany(record.employeeId, scope.companyId))) {
    return NextResponse.json({ error: 'Permission request not found' }, { status: 404 });
  }
  if (record.status !== 'pending') {
    return NextResponse.json({ error: `Request is already ${record.status} — nothing to reject` }, { status: 409 });
  }

  const userId = Number(request.headers.get('x-user-id')) || null;
  const updated = await prisma.permissionRequest.update({
    where: { id: requestId },
    data: { status: 'rejected', approvedByUserId: userId, approvedAt: new Date(), rejectionReason: parsed.data.rejectionReason },
  });

  return NextResponse.json(updated);
}
