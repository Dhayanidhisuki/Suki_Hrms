/**
 * GET /api/biometric/lookup-user?userid=105
 *   — looks up a device enrolment ID in the biometric controller's recent
 *     punch history and returns its display name, for prefilling the "Add
 *     Employee" wizard (Basic Details: Old Employee Code -> Biometric ID).
 *     The device has no employee master, only punch logs, so this scans the
 *     last BIOMETRIC_LOOKUP_WINDOW_DAYS days of daily-attendance rows for a
 *     matching userid (normalised the same way biometricSync.ts matches).
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { biometricApiConfigured, fetchDeviceDailyAttendance } from '@/lib/biometricApi';
import { normaliseDeviceUserId } from '@/lib/biometricSync';

const LOOKUP_WINDOW_DAYS = Number(process.env.BIOMETRIC_LOOKUP_WINDOW_DAYS ?? 30);

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'employee.create');
  if (permErr) return permErr;

  const userid = request.nextUrl.searchParams.get('userid')?.trim();
  if (!userid) {
    return NextResponse.json({ error: 'userid query param is required' }, { status: 400 });
  }

  if (!biometricApiConfigured()) {
    return NextResponse.json({ error: 'Biometric device API is not configured on the server (BIOMETRIC_API_URL / BIOMETRIC_API_KEY).' }, { status: 503 });
  }

  const rangeEnd = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const rangeStart = new Date(rangeEnd.getTime() - (LOOKUP_WINDOW_DAYS - 1) * 86400000);

  let days;
  try {
    days = await fetchDeviceDailyAttendance(rangeStart, rangeEnd);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to reach biometric device API' }, { status: 502 });
  }

  const target = normaliseDeviceUserId(userid);
  const match = [...days].reverse().find((d) => normaliseDeviceUserId(d.userid) === target);

  if (!match) {
    return NextResponse.json({ error: `No punches found for device ID "${userid}" in the last ${LOOKUP_WINDOW_DAYS} days` }, { status: 404 });
  }

  return NextResponse.json({ userid: match.userid, username: match.username });
}
