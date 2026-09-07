/**
 * GET /api/employees/[id]/kyc   — KYC & Statutory tab. PAN/Aadhaar are never
 *                                  returned in full — only masked previews
 *                                  (see src/lib/crypto.ts's maskValue). Use
 *                                  POST .../kyc/reveal for the real values.
 * PUT /api/employees/[id]/kyc   — atomic upsert across EmployeeKyc +
 *                                  EmployeeBankDetail (one combined tab, two
 *                                  tables). panNumber/aadhaarNumber of '' or
 *                                  absent leave the stored encrypted value
 *                                  untouched; a new value is re-encrypted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { kycSchema } from '@/lib/validations/employee';
import { logActivity } from '@/lib/activity-log';
import { encryptField, decryptField, maskValue } from '@/lib/crypto';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const employeeId = parseInt(id);

  const [kyc, bank] = await Promise.all([
    prisma.employeeKyc.findUnique({ where: { employeeId } }),
    prisma.employeeBankDetail.findUnique({ where: { employeeId } }),
  ]);

  return NextResponse.json({
    pfNumber: kyc?.pfNumber ?? null,
    uanNumber: kyc?.uanNumber ?? null,
    esiNumber: kyc?.esiNumber ?? null,
    panNumberMasked: maskValue(decryptField(kyc?.panNumberEnc)),
    aadhaarNumberMasked: maskValue(decryptField(kyc?.aadhaarNumberEnc)),
    drivingLicenceNumber: kyc?.drivingLicenceNumber ?? null,
    drivingLicenceExpiry: kyc?.drivingLicenceExpiry ?? null,
    electionCardNumber: kyc?.electionCardNumber ?? null,
    rationCardNumber: kyc?.rationCardNumber ?? null,
    verificationStatus: kyc?.verificationStatus ?? null,
    verifiedDate: kyc?.verifiedDate ?? null,
    bankName: bank?.bankName ?? null,
    branchName: bank?.branchName ?? null,
    accountNumber: bank?.accountNumber ?? null,
    ifscCode: bank?.ifscCode ?? null,
    accountType: bank?.accountType ?? null,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const employeeId = parseInt(id);
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const employee = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null }, select: { id: true } });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const parsed = kycSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const {
    panNumber, aadhaarNumber,
    bankName, branchName, accountNumber, ifscCode, accountType,
    ...kycFields
  } = parsed.data;

  const existingKyc = await prisma.employeeKyc.findUnique({ where: { employeeId } });

  const kycData: Record<string, unknown> = { ...kycFields };
  if (panNumber) kycData.panNumberEnc = encryptField(panNumber);
  if (aadhaarNumber) kycData.aadhaarNumberEnc = encryptField(aadhaarNumber);

  const wasVerified = existingKyc?.verificationStatus === 'verified';
  if (kycFields.verificationStatus === 'verified' && !wasVerified) {
    kycData.verifiedByUserId = performedByUserId;
    kycData.verifiedDate = new Date();
  } else if (kycFields.verificationStatus !== 'verified') {
    kycData.verifiedByUserId = null;
    kycData.verifiedDate = null;
  }

  const result = await prisma.$transaction(async (tx) => {
    const kyc = await tx.employeeKyc.upsert({
      where: { employeeId },
      update: kycData,
      create: { employeeId, ...kycData },
    });
    const bank = await tx.employeeBankDetail.upsert({
      where: { employeeId },
      update: { bankName, branchName, accountNumber, ifscCode, accountType },
      create: { employeeId, bankName, branchName, accountNumber, ifscCode, accountType },
    });
    await logActivity(tx, {
      employeeId,
      activityType: 'kyc_updated',
      module: 'kyc',
      performedByUserId,
      newValue: { verificationStatus: kycFields.verificationStatus, panChanged: Boolean(panNumber), aadhaarChanged: Boolean(aadhaarNumber) },
    });
    return { kyc, bank };
  });

  return NextResponse.json({
    ...result.kyc,
    panNumberMasked: maskValue(decryptField(result.kyc.panNumberEnc)),
    aadhaarNumberMasked: maskValue(decryptField(result.kyc.aadhaarNumberEnc)),
    ...result.bank,
  });
}
