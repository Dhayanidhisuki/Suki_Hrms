import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkVisitorPermission } from '@/lib/rbac-visitor';
import { getCompanyId } from '@/lib/companyScope';
import { gatePassSchema } from '@/lib/visitor-helpers';

async function getPassInScope(id: string, companyId: number) {
  const passId = Number(id);
  if (isNaN(passId)) return null;
  return prisma.visitorGatePass.findFirst({
    where: { id: passId, companyId, deletedAt: null },
    include: {
      company: { select: { name: true } },
      personToMeet: { select: { firstName: true, lastName: true, employeeCode: true, oldEmployeeCode: true } },
    },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permErr = await checkVisitorPermission(request, 'view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const pass = await getPassInScope(id, scope.companyId);
  if (!pass) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(pass);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permErr = await checkVisitorPermission(request, 'edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const existing = await getPassInScope(id, scope.companyId);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!['DRAFT', 'PENDING_APPROVAL'].includes(existing.status)) {
    return NextResponse.json({ error: 'Can only edit DRAFT or PENDING_APPROVAL requests' }, { status: 400 });
  }

  const body = await request.json();
  const parsed = gatePassSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const userId = Number(request.headers.get('x-user-id')) || null;

  const employee = await prisma.employee.findFirst({
    where: { id: data.personToMeetId, companyId: scope.companyId, deletedAt: null },
  });
  if (!employee) return NextResponse.json({ error: 'Person to meet not found' }, { status: 400 });

  const pass = await prisma.visitorGatePass.update({
    where: { id: existing.id },
    data: {
      passType: data.passType,
      visitorName: data.visitorName,
      mobileNo: data.mobileNo,
      mobilePrefix: data.mobilePrefix,
      visitorTypeValue: data.visitorTypeValue,
      partyName: data.partyName || null,
      email: data.email || null,
      address: data.address || null,
      identityProofType: data.identityProofType || null,
      identityProofNumber: data.identityProofNumber || null,
      visitDate: new Date(data.visitDate),
      validFrom: new Date(data.validFrom),
      validTo: new Date(data.validTo),
      plannedInTime: data.plannedInTime || null,
      plannedOutTime: data.plannedOutTime || null,
      personToMeetId: data.personToMeetId,
      noOfPersons: data.noOfPersons,
      purposeValue: data.purposeValue,
      remarks: data.remarks || null,
      vehicleNumber: data.vehicleNumber || null,
      vehicleType: data.vehicleType || null,
      driverName: data.driverName || null,
      driverMobile: data.driverMobile || null,
      foodRequired: data.foodRequired,
      foodCategory: data.foodCategory || null,
      foodType: data.foodType || null,
      gadgets: data.gadgets || null,
      qrValidMinutes: data.qrValidMinutes,
      updatedBy: userId,
    },
  });

  return NextResponse.json(pass);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permErr = await checkVisitorPermission(request, 'cancel');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const pass = await getPassInScope(id, scope.companyId);
  if (!pass) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.visitorGatePass.update({
    where: { id: pass.id },
    data: { deletedAt: new Date(), updatedBy: Number(request.headers.get('x-user-id')) || null },
  });
  return NextResponse.json({ ok: true });
}
