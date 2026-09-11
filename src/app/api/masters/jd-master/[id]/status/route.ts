/**
 * PATCH /api/jd-master/:id/status — Draft / Active / Archived toggle.
 * Archive is always allowed, even when usageCount > 0.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { jobDescriptionStatusSchema } from '@/lib/validations/jd-master';
import { findActiveDuplicate, jdInclude, serializeJd, usageCountFor } from '@/lib/jd-master';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = jobDescriptionStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const current = await prisma.jobDescription.findFirst({ where: { id, deletedAt: null } });
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (parsed.data.status === 'Active') {
    const duplicate = await findActiveDuplicate(current.departmentId, current.designationId, id);
    if (duplicate && !parsed.data.acknowledgeDuplicate) {
      return NextResponse.json(
        {
          duplicateWarning: true,
          message: `A JD already exists for this Department + Designation (${duplicate.jdCode}) — continue anyway?`,
          existing: duplicate,
        },
        { status: 409 }
      );
    }
  }

  await prisma.jobDescription.update({ where: { id }, data: { status: parsed.data.status } });
  const full = await prisma.jobDescription.findFirstOrThrow({ where: { id }, include: jdInclude });
  const usageCount = await usageCountFor(id);
  return NextResponse.json(serializeJd(full, usageCount));
}
