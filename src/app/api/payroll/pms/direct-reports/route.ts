/** GET /api/payroll/pms/direct-reports — the logged-in manager's own direct reports, for the PMS Incentive entry form's employee picker. */

import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnEmployeeId, listDirectReports } from '@/lib/reportingManager';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }
  const data = await listDirectReports(ownEmployeeId);
  return NextResponse.json({ data });
}
