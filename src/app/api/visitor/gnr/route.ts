import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { checkGNRPermission } from '@/lib/rbac-gnr';
import { gnrSchema, generateGnrNo } from '@/lib/gnr-helpers';
import { notifyVisitorEvent } from '@/lib/visitor-notifications';

export async function GET(request: NextRequest) {
  const permErr = await checkGNRPermission(request, 'view');
  if (permErr) return permErr;

  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { companyId } = scope;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? '';
  const movementType = searchParams.get('movementType') ?? '';
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';

  const where: Prisma.GateNumberRegisterWhereInput = { companyId, deletedAt: null };
  if (status) where.status = status;
  if (movementType) where.movementType = movementType;
  if (dateFrom || dateTo) {
    // Built in one assignment: a typed where cannot be mutated field by field.
    where.dcDate = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }
  if (search) {
    where.OR = [
      { gnrNo: { contains: search } },
      { dcNo: { contains: search } },
      { counterpartyName: { contains: search } },
      { vehicleNumber: { contains: search } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.gateNumberRegister.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { lineItems: true },
    }),
    prisma.gateNumberRegister.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkGNRPermission(request, 'create');
  if (permErr) return permErr;

  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { companyId } = scope;

  const body = await request.json();
  const parsed = gnrSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const userId = Number(request.headers.get('x-user-id')) || null;

  // Prevent duplicate active GNR for same DC + movement type
  const duplicate = await prisma.gateNumberRegister.findFirst({
    where: { companyId, dcNo: data.dcNo, movementType: data.movementType, deletedAt: null, status: { notIn: ['CANCELLED', 'REJECTED'] } },
  });
  if (duplicate) {
    return NextResponse.json({ error: 'An active GNR already exists for this DC and movement type' }, { status: 409 });
  }

  try {
    const gnr = await prisma.$transaction(async (tx) => {
      const gnrNo = await generateGnrNo(tx, companyId, data.movementType);
      return tx.gateNumberRegister.create({
        data: {
          companyId,
          gnrNo,
          dcNo: data.dcNo,
          dcDate: data.dcDate ? new Date(data.dcDate) : null,
          movementType: data.movementType,
          status: 'GNR_CREATED',
          counterpartyType: data.counterpartyType || null,
          counterpartyName: data.counterpartyName || null,
          transporterName: data.transporterName || null,
          sourceLocation: data.sourceLocation || null,
          destinationLocation: data.destinationLocation || null,
          contactName: data.contactName || null,
          contactMobile: data.contactMobile || null,
          purchaseOrderRef: data.purchaseOrderRef || null,
          workOrderRef: data.workOrderRef || null,
          authorizationRef: data.authorizationRef || null,
          vehicleNumber: data.vehicleNumber || null,
          vehicleType: data.vehicleType || null,
          driverName: data.driverName || null,
          driverMobile: data.driverMobile || null,
          driverId: data.driverId || null,
          gateId: data.gateId || null,
          dcDocumentUrl: data.dcDocumentUrl || null,
          supportingDocumentUrl: data.supportingDocumentUrl || null,
          remarks: data.remarks || null,
          createdBy: userId,
          lineItems: {
            create: data.lineItems.map((item) => ({
              materialDescription: item.materialDescription,
              itemCode: item.itemCode || null,
              quantity: item.quantity != null ? item.quantity : null,
              unit: item.unit || null,
              packageCount: item.packageCount ?? null,
              returnable: item.returnable,
              remarks: item.remarks || null,
            })),
          },
        },
        include: { lineItems: true },
      });
    });

    const gnrCreator = gnr.createdBy ? await prisma.user.findUnique({ where: { id: gnr.createdBy }, select: { email: true } }) : null;

    notifyVisitorEvent({
      companyId: scope.companyId,
      event: 'GNR_CREATED',
      recipients: [
        ...(gnr.contactName ? [{ channel: 'IN_APP' as const, address: gnr.contactName }] : []),
        ...(gnrCreator?.email ? [{ channel: 'IN_APP' as const, address: gnrCreator.email }] : []),
      ],
      subject: `GNR ${gnr.gnrNo} created`,
      body: `A GNR (${gnr.gnrNo}) has been created against DC ${gnr.dcNo} for ${gnr.movementType}.`,
      gnrId: gnr.id,
    });

    return NextResponse.json(gnr, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create GNR' }, { status: 400 });
  }
}
