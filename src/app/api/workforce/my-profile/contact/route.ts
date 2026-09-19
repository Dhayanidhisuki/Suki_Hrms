/**
 * PUT /api/workforce/my-profile/contact
 *   The logged-in employee updates their own address/mobile — applies
 *   immediately, no HR approval (BRD decision: low-risk fields only).
 *   Bank, PAN and Aadhaar are never editable through self-service — see
 *   the comment on GET /api/workforce/my-profile.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { contactDetailsSchema } from '@/lib/validations/employee';
import { logActivity } from '@/lib/activity-log';

export async function PUT(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const parsed = contactDetailsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const data = { ...parsed.data };
  if (data.sameAsPermanent) {
    data.presentAddressLine1 = data.permanentAddressLine1;
    data.presentAddressLine2 = data.permanentAddressLine2;
    data.presentCity = data.permanentCity;
    data.presentState = data.permanentState;
    data.presentPincode = data.permanentPincode;
    data.presentMobile = data.permanentMobile;
  }

  const result = await prisma.employeeContactDetails.upsert({
    where: { employeeId: ownEmployeeId },
    create: { employeeId: ownEmployeeId, ...data },
    update: data,
  });

  await logActivity(prisma, {
    employeeId: ownEmployeeId,
    activityType: 'PROFILE_UPDATE',
    module: 'ess.profile',
    performedByUserId: userId,
    newValue: data,
    remarks: 'Updated own address/contact via Self Service',
  }).catch(() => {});

  return NextResponse.json(result);
}
