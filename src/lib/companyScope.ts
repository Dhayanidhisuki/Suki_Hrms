/**
 * Company-scoping helpers, originally written for /api/admin/** but generic
 * to any company-scoped route (workforce/attendance/leave included).
 *
 * companyId must ALWAYS come from getCompanyId() (the verified JWT, via the
 * x-company-id header proxy.ts injects) — never from the request body or a
 * query param — otherwise a company-admin could edit the POST body to
 * read/write another company's data.
 *
 * Call this after the route's permission check has already confirmed there's
 * a valid company-scoped session (any checkXPermission requires x-role-id,
 * which only company-scoped users carry — superadmin never reaches these
 * routes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';

export function getCompanyId(request: NextRequest): { companyId: number } | { error: NextResponse } {
  const raw = request.headers.get('x-company-id');
  const companyId = raw ? Number(raw) : NaN;
  if (!raw || Number.isNaN(companyId)) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized — no company in session' },
        { status: 401 }
      ),
    };
  }
  return { companyId };
}

/**
 * Look up an employee AND confirm it belongs to the caller's own company —
 * a single call that closes the IDOR gap the existing /api/employees/**
 * routes have (they trust employeeId alone, no companyId check). Returns
 * null (not a 403) on company mismatch, matching this app's existing
 * convention of 404-ing cross-tenant lookups rather than revealing they
 * exist.
 */
export async function findEmployeeInCompany(employeeId: number, companyId: number) {
  return prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
  });
}
