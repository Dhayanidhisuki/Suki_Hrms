import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { checkGNRPermission } from '@/lib/rbac-gnr';
import { gnrSchema } from '@/lib/gnr-helpers';

async function getGnrInScope(id: string, companyId: number) {
  const gnrId = Number(id);
  if (isNaN(gnrId)) return null;
  return prisma.gateNumberRegister.findFirst({
    where: { id: gnrId, companyId, deletedAt: null },
    include: { lineItems: true },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permErr = await checkGNRPermission(request, 'view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const gnr = await getGnrInScope(id, scope.companyId);
  if (!gnr) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(gnr);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permErr = await checkGNRPermission(request, 'edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const existing = await getGnrInScope(id, scope.companyId);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const blocked = ['INWARD_RECORDED', 'OUTWARD_RECORDED', 'COMPLETED', 'CANCELLED', 'REJECTED'];
  if (blocked.includes(existing.status)) {
    return NextResponse.json({ error: 'Cannot edit after transaction is completed/cancelled' }, { status: 400 });
  }

  const body = await request.json();
  const parsed = gnrSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const userId = Number(request.headers.get('x-user-id')) || null;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.gNRLineItem.deleteMany({ where: { gnrId: existing.id } });
      return tx.gateNumberRegister.update({
        where: { id: existing.id },
        data: {
          dcNo: data.dcNo,
          dcDate: data.dcDate ? new Date(data.dcDate) : null,
          movementType: data.movementType,
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
          updatedBy: userId,
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

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update GNR' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permErr = await checkGNRPermission(request, 'delete');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const existing = await getGnrInScope(id, scope.companyId);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.gateNumberRegister.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), updatedBy: Number(request.headers.get('x-user-id')) || null },
  });
  return NextResponse.json({ ok: true });
}
