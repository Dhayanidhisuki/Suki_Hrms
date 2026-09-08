/**
 * GET  /api/payroll/pms?scope=mine|hr
 *      — mine: submissions the logged-in manager created (managerActionByUserId=self).
 *      — hr: all pending_hr submissions for the company (RBAC-gated on payroll.pms.view).
 * POST /api/payroll/pms
 *      — the logged-in Reporting Manager submits their percentage for one
 *        of their own direct reports for one month. Always starts at
 *        pending_hr (see schema.prisma's PmsIncentive.status comment — the
 *        manager IS the submitter, not a reviewer). companyPercent is
 *        always the fixed 50 (BRD) and isn't accepted from the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId, isReportingManagerOf } from '@/lib/reportingManager';
import { pmsIncentiveCreateSchema } from '@/lib/validations/workforce';

const COMPANY_PERCENT = 50;

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const scopeParam = request.nextUrl.searchParams.get('scope') ?? 'mine';
  const include = { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } };

  if (scopeParam === 'mine') {
    const data = await prisma.pmsIncentive.findMany({
      where: { managerActionByUserId: userId, employee: { companyId: scope.companyId } },
      include,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    return NextResponse.json({ data });
  }

  if (scopeParam === 'hr') {
    const permErr = await checkSpecificPermission(request, 'payroll.pms.view');
    if (permErr) return permErr;
    const data = await prisma.pmsIncentive.findMany({
      where: { status: 'pending_hr', employee: { companyId: scope.companyId } },
      include,
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: 'scope must be one of: mine, hr' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const parsed = pmsIncentiveCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  if (!(await isReportingManagerOf(ownEmployeeId, parsed.data.employeeId))) {
    return NextResponse.json({ error: 'Forbidden — you can only submit PMS incentive for your own direct reports' }, { status: 403 });
  }

  const existing = await prisma.pmsIncentive.findUnique({
    where: { employeeId_year_month: { employeeId: parsed.data.employeeId, year: parsed.data.year, month: parsed.data.month } },
  });
  if (existing) {
    return NextResponse.json({ error: 'A PMS incentive submission already exists for this employee and month' }, { status: 409 });
  }

  const totalPercent = COMPANY_PERCENT + parsed.data.managerPercent;
  const record = await prisma.pmsIncentive.create({
    data: {
      employeeId: parsed.data.employeeId,
      year: parsed.data.year,
      month: parsed.data.month,
      companyPercent: COMPANY_PERCENT,
      managerPercent: parsed.data.managerPercent,
      totalPercent,
      status: 'pending_hr',
      managerActionByUserId: userId,
      managerActionAt: new Date(),
    },
  });

  return NextResponse.json(record, { status: 201 });
}
