/**
 * GET  /api/visitor/gate-passes — list all passes for the company
 * POST /api/visitor/gate-passes — create a new gate pass
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkVisitorPermission } from '@/lib/rbac-visitor';
import { getCompanyId } from '@/lib/companyScope';
import { gatePassSchema, generateGatePassNo, generateQrToken } from '@/lib/visitor-helpers';

export async function GET(request: NextRequest) {
  const permErr = await checkVisitorPermission(request, 'view');
  if (permErr) return permErr;

  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { companyId } = scope;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? '';
  const passType = searchParams.get('passType') ?? '';
  const personToMeetId = searchParams.get('personToMeetId') ?? '';
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';

  const where: Prisma.VisitorGatePassWhereInput = { companyId, deletedAt: null };
  if (status) where.status = status;
  if (passType) where.passType = passType;
  if (personToMeetId) where.personToMeetId = parseInt(personToMeetId);
  if (dateFrom || dateTo) {
    // Built in one assignment: a typed where cannot be mutated field by field.
    where.visitDate = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }
  if (search) {
    where.OR = [
      { visitorName: { contains: search } },
      { gatePassNo: { contains: search } },
      { mobileNo: { contains: search } },
      { purposeValue: { contains: search } },
      { visitorTypeValue: { contains: search } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.visitorGatePass.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { name: true } },
        personToMeet: { select: { id: true, firstName: true, lastName: true, employeeCode: true, oldEmployeeCode: true } },
      },
    }),
    prisma.visitorGatePass.count({ where }),
  ]);

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const permErr = await checkVisitorPermission(request, 'create');
  if (permErr) return permErr;

  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { companyId } = scope;

  const body = await request.json();
  const parsed = gatePassSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const userId = Number(request.headers.get('x-user-id')) || null;

  // Verify the employee belongs to this company
  const employee = await prisma.employee.findFirst({
    where: { id: data.personToMeetId, companyId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Person to meet not found in this company' }, { status: 400 });
  }

  try {
    const pass = await prisma.$transaction(async (tx) => {
      const gatePassNo = await generateGatePassNo(tx, companyId, data.visitorTypeValue);
      const qrToken = generateQrToken();

      return tx.visitorGatePass.create({
        data: {
          companyId,
          gatePassNo,
          passType: data.passType,
          status: 'DRAFT',
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
          qrToken,
          qrValidMinutes: data.qrValidMinutes,
          createdBy: userId,
        },
      });
    });

    return NextResponse.json(pass, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create gate pass' },
      { status: 400 }
    );
  }
}
