/**
 * GET /api/workforce/my-benefits
 *   The logged-in employee's own benefit enrolments — component name/code,
 *   the rate that applies to them, and the employee type the rate is set for.
 *   Self-service: employeeId is resolved from the session, never taken from
 *   the client, and no HR-level grant is required to read your own row.
 *
 *   Deliberately NOT the same data as /api/workforce/benefits/overview: that
 *   one is the HR view and includes every enrolled employee in the company.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const enrolments = await prisma.employeeBenefit.findMany({
    where: {
      employeeId: ownEmployeeId,
      isActive: true,
      benefitRate: { companyId: scope.companyId, isActive: true },
    },
    select: {
      id: true,
      createdAt: true,
      benefitRate: {
        select: {
          code: true,
          name: true,
          amount: true,
          employeeType: { select: { name: true } },
          salaryComponent: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    data: enrolments.map((e) => ({
      id: e.id,
      code: e.benefitRate.code,
      name: e.benefitRate.name,
      amount: Number(e.benefitRate.amount),
      employeeType: e.benefitRate.employeeType?.name ?? null,
      salaryComponent: e.benefitRate.salaryComponent?.name ?? null,
      enrolledOn: e.createdAt,
    })),
  });
}
