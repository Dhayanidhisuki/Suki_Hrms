/**
 * DELETE /api/recruitment/job-postings/:id — soft-delete a posting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const current = await prisma.jobPosting.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.jobPosting.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ message: 'Deleted' });
}
