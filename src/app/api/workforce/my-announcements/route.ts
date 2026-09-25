/**
 * GET /api/workforce/my-announcements — published announcements for the
 * signed-in employee, newest first, with their own read state.
 *
 * Self-service: the employee is resolved from the session, never from a query
 * param, and no permission grant is required — same contract as every other
 * /api/workforce/my-* route.
 *
 * Unlike the other my-* routes this one does NOT require a linked employee
 * record. Announcements are company-wide, and an HR or admin login often has
 * no Employee row of its own; refusing them the company's own circulars would
 * be absurd. Such a login reads the list with `canMarkRead: false` — there is
 * no employee to attribute a read receipt to.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { parseScopeValues, type AnnouncementAudienceScopeType } from '@/lib/employee/scope';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const ownEmployeeId = await resolveOwnEmployeeId(userId);

  const now = new Date();
  const rows = await prisma.announcement.findMany({
    where: {
      companyId: scope.companyId,
      status: 'PUBLISHED',
      deletedAt: null,
      // An expiry that has passed drops the item off the employee's list; it
      // stays in the HR archive.
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ publishedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      body: true,
      category: true,
      priority: true,
      publishedAt: true,
      expiresAt: true,
      audienceScopeType: true,
      audienceScopeValues: true,
      // -1 never matches a real employee id, so a login without an employee
      // record simply comes back with no receipts rather than needing a
      // second query shape.
      reads: { where: { employeeId: ownEmployeeId ?? -1 }, select: { readAt: true } },
    },
  });

  // An announcement targeting a specific department/designation/etc. only
  // reaches employees whose current job info matches it; a login with no
  // linked Employee row (ownEmployeeId === null) has nothing to match against,
  // so it only sees untargeted (company-wide) announcements — same as today.
  const myScopeCodes: Partial<Record<AnnouncementAudienceScopeType, string>> = {};
  if (ownEmployeeId) {
    const jobInfo = await prisma.jobInfo.findFirst({
      where: { employeeId: ownEmployeeId, effectiveTo: null },
      select: {
        department: { select: { code: true } },
        subDepartment: { select: { code: true } },
        designation: { select: { code: true } },
        employeeType: { select: { code: true } },
        unit: { select: { code: true } },
      },
    });
    if (jobInfo) {
      if (jobInfo.department?.code) myScopeCodes.DEPARTMENT = jobInfo.department.code;
      if (jobInfo.subDepartment?.code) myScopeCodes.SUB_DEPARTMENT = jobInfo.subDepartment.code;
      if (jobInfo.designation?.code) myScopeCodes.DESIGNATION = jobInfo.designation.code;
      if (jobInfo.employeeType?.code) myScopeCodes.EMPLOYEE_TYPE = jobInfo.employeeType.code;
      if (jobInfo.unit?.code) myScopeCodes.UNIT = jobInfo.unit.code;
    }
  }

  const data = rows
    .filter((r) => {
      if (!r.audienceScopeType) return true;
      const myCode = myScopeCodes[r.audienceScopeType as AnnouncementAudienceScopeType];
      if (!myCode) return false;
      return parseScopeValues(r.audienceScopeValues).includes(myCode);
    })
    .map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      category: r.category,
      priority: r.priority,
      publishedAt: r.publishedAt,
      expiresAt: r.expiresAt,
      readAt: r.reads[0]?.readAt ?? null,
    }));

  // IMPORTANT items sort above NORMAL ones; within a band the newest wins
  // (the query already ordered by publishedAt, so this is a stable partition).
  data.sort((a, b) => Number(b.priority === 'IMPORTANT') - Number(a.priority === 'IMPORTANT'));

  return NextResponse.json({
    data,
    unreadCount: ownEmployeeId ? data.filter((a) => a.readAt === null).length : 0,
    canMarkRead: ownEmployeeId !== null,
  });
}
