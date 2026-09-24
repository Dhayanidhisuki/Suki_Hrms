/**
 * GET  /api/workforce/attendance/app-sync
 *      — app-database sync status: whether the ESSL connection is
 *        configured/enabled, the last 10 runs, and the employee codes from
 *        the latest run that matched no employee.
 * GET  /api/workforce/attendance/app-sync?test=1
 *      — one probe query against the app database; returns ok/ms and the
 *        failure reason. No writes.
 * POST /api/workforce/attendance/app-sync  { startDate, endDate }
 *      — run the app sync now for that range (max 62 days). Each app day
 *        is recorded as its source contribution and re-merged with the
 *        biometric contribution; locked months and human-decided days are
 *        skipped/reported, never overwritten.
 *
 * Lives under the protected /api/workforce/ prefix on purpose — the auth
 * proxy already covers it, and it reuses the biometric permission codes
 * (no new RBAC keys required).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { appDbConfigured, appSyncEnabled, testAppDbConnection } from '@/lib/appAttendanceDb';
import { runAppSync } from '@/lib/appAttendanceSync';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD expected');
const syncSchema = z.object({ startDate: isoDate, endDate: isoDate });

function parseUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.biometric.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  if (new URL(request.url).searchParams.get('test') === '1') {
    return NextResponse.json(await testAppDbConnection());
  }

  const runs = await prisma.attendanceSyncRun.findMany({
    where: { companyId: scope.companyId, source: 'app' },
    orderBy: { startedAt: 'desc' },
    take: 10,
  });
  const latestSuccess = runs.find((r) => r.status === 'success');

  return NextResponse.json({
    configured: appDbConfigured(),
    enabled: appSyncEnabled(),
    server: process.env.ESSL_DB_SERVER ?? null, // host only, never credentials
    database: process.env.ESSL_DB_NAME ?? null,
    runs: runs.map((r) => ({ ...r, unmatchedUserIds: undefined })),
    unmatched: latestSuccess?.unmatchedUserIds ? JSON.parse(latestSuccess.unmatchedUserIds) : [],
  });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.biometric.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  if (!appSyncEnabled()) {
    return NextResponse.json(
      { error: 'App attendance sync is not enabled (ESSL_SYNC_ENABLED / ESSL_DB_* settings).' },
      { status: 503 }
    );
  }

  const parsed = syncSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const rangeStart = parseUtc(parsed.data.startDate);
  const rangeEnd = parseUtc(parsed.data.endDate);
  if (rangeEnd < rangeStart) {
    return NextResponse.json({ error: 'endDate must be on or after startDate' }, { status: 400 });
  }
  const spanDays = (rangeEnd.getTime() - rangeStart.getTime()) / 86400000 + 1;
  if (spanDays > 62) {
    return NextResponse.json({ error: 'Sync at most 62 days at a time' }, { status: 400 });
  }

  const userId = Number(request.headers.get('x-user-id')) || null;
  const outcome = await runAppSync({ companyId: scope.companyId, rangeStart, rangeEnd, trigger: 'manual', triggeredByUserId: userId });

  return NextResponse.json(outcome, { status: outcome.status === 'success' ? 200 : 502 });
}
