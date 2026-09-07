/**
 * POST /api/employees/[id]/kyc/reveal — decrypt and return the real PAN and
 * Aadhaar numbers. Gated by employee.kyc.reveal, a permission distinct from
 * employee.kyc.view (which only ever sees masked values) — every reveal is
 * also logged to EmployeeActivity for audit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { logActivity } from '@/lib/activity-log';
import { decryptField } from '@/lib/crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'employee.kyc.reveal');
  if (permErr) return permErr;
  const { id } = await params;
  const employeeId = parseInt(id);
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const kyc = await prisma.employeeKyc.findUnique({ where: { employeeId } });
  if (!kyc) return NextResponse.json({ error: 'No KYC record found' }, { status: 404 });

  const panNumber = decryptField(kyc.panNumberEnc);
  const aadhaarNumber = decryptField(kyc.aadhaarNumberEnc);

  await logActivity(prisma, {
    employeeId,
    activityType: 'kyc_revealed',
    module: 'kyc',
    performedByUserId,
    remarks: 'Sensitive KYC fields (PAN/Aadhaar) were revealed in full',
  });

  return NextResponse.json({ panNumber, aadhaarNumber });
}
