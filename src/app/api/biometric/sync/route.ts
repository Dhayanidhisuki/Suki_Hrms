/**
 * GET  /api/biometric/sync
 *      — sync status for the Biometric page: whether the device API is
 *        configured, scheduler timing, the last 10 runs, and the device
 *        user IDs from the latest run that matched no employee.
 * GET  /api/biometric/sync?test=1
 *      — one probe request to the device API; returns ok/httpStatus/ms and
 *        a human-readable reason on failure (ECONNREFUSED, timeout, ...).
 * POST /api/biometric/sync  { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 *      — run the device sync now for that range (max 62 days), e.g. a
 *        month catch-up before payroll. Same code path as the 8-hourly job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { biometricApiConfigured, testDeviceConnection } from '@/lib/biometricApi';
import { runBiometricSync } from '@/lib/biometricSync';
import { getSchedulerState } from '@/lib/biometricScheduler';

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

  // ?test=1 — probe the device API once (no DB writes) and report exactly
  // why it can/can't be reached. Backs the page's "Test connection" button.
  if (new URL(request.url).searchParams.get('test') === '1') {
    return NextResponse.json(await testDeviceConnection());
  }

  const runs = await prisma.biometricSyncRun.findMany({
    where: { companyId: scope.companyId },
    orderBy: { startedAt: 'desc' },
    take: 10,
  });
  const latestSuccess = runs.find((r) => r.status === 'success');
  const scheduler = getSchedulerState();

  return NextResponse.json({
    configured: biometricApiConfigured(),
    apiUrl: process.env.BIOMETRIC_API_URL ?? null, // host only, never the key
    scheduler: scheduler
      ? {
          intervalHours: scheduler.intervalMs / 3600000,
          running: scheduler.running,
          lastStartedAt: scheduler.lastStartedAt,
          lastFinishedAt: scheduler.lastFinishedAt,
          nextRunAt: scheduler.nextRunAt,
        }
      : null,
    runs: runs.map((r) => ({ ...r, unmatchedUserIds: undefined })),
    unmatched: latestSuccess?.unmatchedUserIds ? JSON.parse(latestSuccess.unmatchedUserIds) : [],
  });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.biometric.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  if (!biometricApiConfigured()) {
    return NextResponse.json({ error: 'Biometric device API is not configured on the server (BIOMETRIC_API_URL / BIOMETRIC_API_KEY).' }, { status: 503 });
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
  const outcome = await runBiometricSync({ companyId: scope.companyId, rangeStart, rangeEnd, trigger: 'manual', triggeredByUserId: userId });

  return NextResponse.json(outcome, { status: outcome.status === 'success' ? 200 : 502 });
}
