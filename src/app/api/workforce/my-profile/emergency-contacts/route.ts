/**
 * POST   /api/workforce/my-profile/emergency-contacts — add one for the caller's own record.
 * PUT    /api/workforce/my-profile/emergency-contacts?id=X — edit one of the caller's own.
 * DELETE /api/workforce/my-profile/emergency-contacts?id=X — remove one of the caller's own.
 * Self-service: applies immediately, no HR approval (low-risk).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { emergencyContactSchema } from '@/lib/validations/employee';
import { logActivity } from '@/lib/activity-log';

async function requireOwnEmployeeId(request: NextRequest): Promise<{ id: number } | { error: NextResponse }> {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 }) };
  const id = await resolveOwnEmployeeId(userId);
  if (!id) return { error: NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 }) };
  return { id };
}

export async function POST(request: NextRequest) {
  const own = await requireOwnEmployeeId(request);
  if ('error' in own) return own.error;

  const parsed = emergencyContactSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Only one contact may be isPrimary per employee — same invariant the
  // HR-side route enforces.
  const record = await prisma.$transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      await tx.employeeEmergencyContact.updateMany({ where: { employeeId: own.id }, data: { isPrimary: false } });
    }
    const created = await tx.employeeEmergencyContact.create({ data: { employeeId: own.id, ...parsed.data } });
    await logActivity(tx, {
      employeeId: own.id,
      activityType: 'emergency_contact_added',
      module: 'ess.profile',
      performedByUserId: Number(request.headers.get('x-user-id')) || null,
      newValue: { contactName: parsed.data.contactName, isPrimary: parsed.data.isPrimary },
      relatedRecordId: created.id,
      remarks: 'Added via Self Service',
    });
    return created;
  });
  return NextResponse.json(record, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const own = await requireOwnEmployeeId(request);
  if ('error' in own) return own.error;

  const id = Number(request.nextUrl.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const existing = await prisma.employeeEmergencyContact.findFirst({ where: { id, employeeId: own.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = emergencyContactSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.$transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      await tx.employeeEmergencyContact.updateMany({ where: { employeeId: own.id, id: { not: id } }, data: { isPrimary: false } });
    }
    return tx.employeeEmergencyContact.update({ where: { id }, data: parsed.data });
  });
  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest) {
  const own = await requireOwnEmployeeId(request);
  if ('error' in own) return own.error;

  const id = Number(request.nextUrl.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { count } = await prisma.employeeEmergencyContact.deleteMany({ where: { id, employeeId: own.id } });
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ deleted: id });
}
