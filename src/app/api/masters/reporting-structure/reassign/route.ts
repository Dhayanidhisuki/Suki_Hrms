/**
 * POST /api/masters/reporting-structure/reassign
 * Body: { oldManagerId: number, newManagerId: number | null }
 *
 * Bulk reassign: when a manager leaves or is reassigned, move all their
 * direct reports (Level 1) to a new manager. Also clears secondReportingManagerId
 * if it points to the departing manager.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { reassignAllReports } from '@/lib/reportingManager';

export async function POST(request: NextRequest) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { companyId } = scope;

  const body = await request.json().catch(() => null);
  if (!body?.oldManagerId || typeof body.oldManagerId !== 'number') {
    return NextResponse.json({ error: 'oldManagerId is required' }, { status: 400 });
  }

  const oldManagerId = body.oldManagerId;
  const newManagerId = body.newManagerId ?? null;

  // Verify both belong to same company
  const oldMgr = await prisma.employee.findFirst({
    where: { id: oldManagerId, companyId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!oldMgr) {
    return NextResponse.json({ error: 'Old manager not found' }, { status: 404 });
  }

  if (newManagerId !== null) {
    const newMgr = await prisma.employee.findFirst({
      where: { id: newManagerId, companyId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!newMgr) {
      return NextResponse.json({ error: 'New manager not found' }, { status: 404 });
    }
    if (newManagerId === oldManagerId) {
      return NextResponse.json({ error: 'New manager must be different from old manager' }, { status: 400 });
    }
  }

  const result = await reassignAllReports(oldManagerId, newManagerId);
  const newMgrName = newManagerId
    ? (await prisma.employee.findFirst({ where: { id: newManagerId }, select: { firstName: true, lastName: true } }))
    : null;
  const targetName = newMgrName ? `${newMgrName.firstName} ${newMgrName.lastName}` : 'no manager (unassigned)';

  return NextResponse.json({
    message: `Reassigned ${result.reassigned} report(s) from ${oldMgr.firstName} ${oldMgr.lastName} to ${targetName}`,
    reassigned: result.reassigned,
  });
}
