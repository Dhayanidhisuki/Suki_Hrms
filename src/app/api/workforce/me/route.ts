/**
 * GET /api/workforce/me
 *   The logged-in user's own employee id, if their login is linked to one.
 *   Small self-lookup used by ESS pages that must pass ownerEntityId
 *   explicitly to a shared (non-self-scoped) API, e.g. the platform
 *   document endpoints, which take ownerEntityId from the client because
 *   HR also uses them to act on other employees' documents.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const employeeId = await resolveOwnEmployeeId(userId);
  return NextResponse.json({ employeeId });
}
