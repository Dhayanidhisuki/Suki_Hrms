/**
 * GET /api/workforce/my-profile
 *   The logged-in employee's own profile summary — basic details, contact
 *   address, personal details, emergency contacts, and bank/KYC shown
 *   masked (never editable here — see the route comment on PUT below).
 *   Self-service: employeeId is resolved from the session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { decryptField, maskValue } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const employee = await prisma.employee.findFirst({
    where: { id: ownEmployeeId, deletedAt: null },
    select: {
      employeeCode: true,
      firstName: true,
      middleName: true,
      lastName: true,
      status: true,
      lifecycleState: true,
      company: { select: { name: true } },
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: {
          joinDate: true,
          department: { select: { name: true } },
          designation: { select: { name: true } },
        },
      },
      personalDetails: true,
      contactDetails: true,
      bankDetail: { select: { bankName: true, accountNumber: true, ifscCode: true } },
      kyc: { select: { panNumberEnc: true, aadhaarNumberEnc: true } },
      emergencyContacts: { orderBy: { isPrimary: 'desc' } },
    },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  return NextResponse.json({
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    middleName: employee.middleName,
    lastName: employee.lastName,
    status: employee.status,
    lifecycleState: employee.lifecycleState,
    companyName: employee.company?.name ?? null,
    joinDate: employee.jobInfos[0]?.joinDate ?? null,
    department: employee.jobInfos[0]?.department?.name ?? null,
    designation: employee.jobInfos[0]?.designation?.name ?? null,
    personalDetails: employee.personalDetails,
    contactDetails: employee.contactDetails,
    emergencyContacts: employee.emergencyContacts,
    // Bank/statutory identity — masked, view-only. Changing these needs HR
    // review (fraud-sensitive: a wrong bank account misdirects salary), so
    // there is deliberately no self-service edit path for them, unlike
    // address/emergency-contact below.
    bank: employee.bankDetail
      ? { bankName: employee.bankDetail.bankName, accountNumber: maskValue(employee.bankDetail.accountNumber), ifscCode: employee.bankDetail.ifscCode }
      : null,
    pan: maskValue(decryptField(employee.kyc?.panNumberEnc ?? null)),
    aadhaar: maskValue(decryptField(employee.kyc?.aadhaarNumberEnc ?? null)),
  });
}
