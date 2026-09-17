import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { generateGatePassNo, generateQrToken } from '@/lib/visitor-helpers';
import { z } from 'zod';

const requestSchema = z.object({
  visitorName: z.string().min(1).max(100),
  mobileNo: z.string().regex(/^\d{10}$/, 'Must be 10 digits'),
  // The form submits '' for an untouched optional field, which .optional()
  // does not treat as absent — so a blank email failed .email() and blocked
  // every request. Normalise empty to undefined before validating.
  email: z.preprocess((v) => (v === '' ? undefined : v), z.string().email().optional()),
  address: z.string().max(500).optional(),
  visitorTypeValue: z.string().min(1),
  purposeValue: z.string().min(1),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plannedInTime: z.string().optional().nullable(),
  plannedOutTime: z.string().optional().nullable(),
  noOfPersons: z.number().int().min(1).optional().default(1),
  qrValidHours: z.number().min(1).optional().default(24),
  foodRequired: z.boolean().optional().default(false),
  foodCategory: z.string().optional().nullable(),
  foodType: z.string().optional().nullable(),
  gadgets: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const employeeId = await resolveOwnEmployeeId(userId);
  if (!employeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  try {
    const data = await prisma.visitorGatePass.findMany({
      where: { personToMeetId: employeeId },
      select: {
        id: true,
        gatePassNo: true,
        visitorName: true,
        mobileNo: true,
        visitorTypeValue: true,
        purposeValue: true,
        visitDate: true,
        status: true,
        createdAt: true,
        validFrom: true,
        validTo: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch visitor passes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const employeeId = await resolveOwnEmployeeId(userId);
  if (!employeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const data = parsed.data;
    const qrValidMinutes = Math.round(data.qrValidHours * 60);

    const pass = await prisma.$transaction(async (tx) => {
      const gatePassNo = await generateGatePassNo(tx as any, employee.companyId, data.visitorTypeValue);
      const qrToken = generateQrToken();

      return await tx.visitorGatePass.create({
        data: {
          companyId: employee.companyId,
          gatePassNo,
          qrToken,
          passType: 'VISITOR',
          status: 'PENDING_APPROVAL',
          visitorName: data.visitorName,
          mobileNo: data.mobileNo,
          email: data.email || null,
          address: data.address || null,
          visitorTypeValue: data.visitorTypeValue,
          purposeValue: data.purposeValue,
          visitDate: new Date(data.visitDate),
          validFrom: new Date(data.validFrom),
          validTo: new Date(data.validTo),
          plannedInTime: data.plannedInTime || null,
          plannedOutTime: data.plannedOutTime || null,
          noOfPersons: data.noOfPersons,
          foodRequired: data.foodRequired,
          foodCategory: data.foodCategory || null,
          foodType: data.foodType || null,
          gadgets: data.gadgets || null,
          qrValidMinutes,
          personToMeetId: employeeId,
          createdBy: userId,
        },
      });
    });

    return NextResponse.json(pass, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create visitor pass request' },
      { status: 500 }
    );
  }
}
