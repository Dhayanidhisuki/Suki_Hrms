/**
 * GET /api/dashboard/attendance-overview?groupBy=employee
 *
 * The attendance cross-tab on its own, for the grouping the main dashboard
 * payload does not carry. Department and unit ship with
 * /api/dashboard/overview because they cost almost nothing; employee
 * multiplies the row count by headcount, so the chart asks for it here only
 * when that view is selected.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { attendanceOverview, type AttendanceGroupBy } from '@/lib/attendanceOverview';

function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'employee.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const requested = request.nextUrl.searchParams.get('groupBy');
  const groupBy: AttendanceGroupBy =
    requested === 'unit' || requested === 'employee' ? requested : 'department';

  const data = await attendanceOverview(scope.companyId, startOfDay(new Date()), groupBy);
  return NextResponse.json(data);
}
