/**
 * Device-API biometric sync: pulls the daily first-in / last-out rollup from
 * the biometric controller (src/lib/biometricApi.ts) for a date range and
 * writes DailyAttendance rows through the same history-preserving upsert
 * and the same status / OT / late derivation the legacy import uses
 * (src/lib/biometricConversion.ts), so both ingestion paths behave alike.
 *
 * Runs every BIOMETRIC_SYNC_INTERVAL_HOURS from src/instrumentation.ts and
 * on demand from POST /api/biometric/sync. Every run is recorded as a
 * BiometricSyncRun with counts and the device user IDs that matched no
 * employee.
 *
 * Deliberate v1 limits:
 *  - Only days the device reports are written. Absent days for people with
 *    no punches are NOT created here — the Overview page shows them as
 *    "No Record" and Finalize/LOP handling stays with the time office until
 *    the auto-absent rule is confirmed with the client.
 *  - Frozen months are skipped (counted), never written.
 *  - Employee matching is by Employee Code (Employee.oldEmployeeCode) only,
 *    with a light normalisation — see resolveDeviceUser. Different
 *    controllers report the same person as "120" and "E120", so "E"
 *    prefixes and leading zeros are ignored. No fallback to the system code.
 */

import { prisma } from './prisma';
import { fetchDeviceDailyAttendance, type ParsedDeviceDay } from './biometricApi';
import { upsertDailyAttendanceWithHistory } from './attendanceHistory';
import { deriveStatusAndMinutes, resolveDailyShift, resolveEmployeeShiftConfig, refreshMonthlySummary, type EmployeeShiftConfig } from './biometricConversion';

export interface SyncOptions {
  companyId: number;
  rangeStart: Date; // UTC midnight, inclusive
  rangeEnd: Date; // UTC midnight, inclusive
  trigger: 'scheduled' | 'manual';
  triggeredByUserId?: number | null;
}

export interface UnmatchedDeviceUser {
  userid: string;
  username: string;
  days: number;
}

export interface SyncOutcome {
  runId: number;
  status: 'success' | 'failed';
  rowsFetched: number;
  daysCreated: number;
  daysUpdated: number;
  daysUnchanged: number;
  skippedFrozen: number;
  unmatched: UnmatchedDeviceUser[];
  error?: string;
}

/** "E062" -> "62", "099" -> "99", "105" -> "105" — the key both sides are compared on. */
export function normaliseDeviceUserId(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/^E/, '').replace(/^0+(?=\d)/, '');
  return s;
}

/**
 * Builds the device-user -> employee lookup for one company: Employee Code
 * (Employee.oldEmployeeCode) only, the same field the legacy import matches
 * on. There is deliberately NO fallback to the system code (EMPnnn): the
 * device's own test user "1" would otherwise land on EMP001.
 */
async function buildEmployeeLookup(companyId: number): Promise<Map<string, number>> {
  const employees = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, isActive: true, oldEmployeeCode: { not: null } },
    select: { id: true, oldEmployeeCode: true },
  });
  const byCode = new Map<string, number>();
  for (const e of employees) {
    if (e.oldEmployeeCode?.trim()) byCode.set(normaliseDeviceUserId(e.oldEmployeeCode), e.id);
  }
  return byCode;
}

export function resolveDeviceUser(lookup: Map<string, number>, userid: string): number | null {
  return lookup.get(normaliseDeviceUserId(userid)) ?? null;
}

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function isMonthFrozen(employeeId: number, date: Date): Promise<boolean> {
  const summary = await prisma.monthlyAttendanceSummary.findUnique({
    where: { employeeId_year_month: { employeeId, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 } },
    select: { status: true },
  });
  return summary?.status === 'FROZEN';
}

export async function runBiometricSync(opts: SyncOptions): Promise<SyncOutcome> {
  const rangeStart = utcMidnight(opts.rangeStart);
  const rangeEnd = utcMidnight(opts.rangeEnd);

  const run = await prisma.biometricSyncRun.create({
    data: {
      companyId: opts.companyId,
      trigger: opts.trigger,
      rangeStart,
      rangeEnd,
      triggeredByUserId: opts.triggeredByUserId ?? null,
    },
  });

  const counts = { rowsFetched: 0, daysCreated: 0, daysUpdated: 0, daysUnchanged: 0, skippedFrozen: 0 };
  const unmatched = new Map<string, UnmatchedDeviceUser>();

  try {
    const days: ParsedDeviceDay[] = await fetchDeviceDailyAttendance(rangeStart, rangeEnd);
    counts.rowsFetched = days.length;

    const lookup = await buildEmployeeLookup(opts.companyId);
    const shiftConfigs = new Map<number, EmployeeShiftConfig>();
    const touchedMonths = new Set<string>();

    for (const day of days) {
      const employeeId = resolveDeviceUser(lookup, day.userid);
      if (!employeeId) {
        const key = day.userid;
        const u = unmatched.get(key) ?? { userid: day.userid, username: day.username, days: 0 };
        u.days += 1;
        unmatched.set(key, u);
        continue;
      }

      if (await isMonthFrozen(employeeId, day.date)) {
        counts.skippedFrozen += 1;
        continue;
      }

      let config = shiftConfigs.get(employeeId);
      if (!config) {
        config = await resolveEmployeeShiftConfig(employeeId);
        shiftConfigs.set(employeeId, config);
      }
      const shift = resolveDailyShift(config, day.date);

      const inTime = day.firstIn?.at ?? null;
      // A single punch is not a pair — keep it as the in-punch and flag the day.
      const outTime = day.lastOut && day.firstIn && day.lastOut.at.getTime() !== day.firstIn.at.getTime() ? day.lastOut.at : null;

      const derived = deriveStatusAndMinutes(null, inTime, outTime, shift, config.otThresholdMinutes, config.maxOtMinutesPerDay);
      const status = inTime && !outTime ? 'MissingPunch' : derived.status;

      const result = await upsertDailyAttendanceWithHistory(
        prisma,
        employeeId,
        day.date,
        {
          status,
          inTime,
          outTime,
          workingMinutes: derived.workingMinutes,
          otMinutesCalculated: derived.otMinutes,
          lateMinutes: derived.lateMinutes,
          source: 'biometric',
          shiftMasterId: shift.shiftMasterId,
        },
        { userId: opts.triggeredByUserId ?? null, changedBySource: 'biometric' }
      );
      if (result.outcome === 'created') counts.daysCreated += 1;
      else if (result.outcome === 'updated') counts.daysUpdated += 1;
      else counts.daysUnchanged += 1;

      touchedMonths.add(`${employeeId}:${day.date.getUTCFullYear()}-${day.date.getUTCMonth() + 1}`);
    }

    for (const key of touchedMonths) {
      const [emp, ym] = key.split(':');
      const [y, m] = ym.split('-').map(Number);
      await refreshMonthlySummary(Number(emp), y, m);
    }

    const unmatchedList = Array.from(unmatched.values()).sort((a, b) => b.days - a.days);
    await prisma.biometricSyncRun.update({
      where: { id: run.id },
      data: { ...counts, status: 'success', unmatchedUserIds: JSON.stringify(unmatchedList), finishedAt: new Date() },
    });
    return { runId: run.id, status: 'success', ...counts, unmatched: unmatchedList };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const unmatchedList = Array.from(unmatched.values());
    await prisma.biometricSyncRun
      .update({
        where: { id: run.id },
        data: { ...counts, status: 'failed', error: message.slice(0, 2000), unmatchedUserIds: JSON.stringify(unmatchedList), finishedAt: new Date() },
      })
      .catch(() => {});
    console.error('[biometric-sync] run failed', { runId: run.id, message });
    return { runId: run.id, status: 'failed', ...counts, unmatched: unmatchedList, error: message };
  }
}

/** The scheduler's default window: the last N days up to today, so late out-punches and device delays are picked up on the next run. */
export function defaultSyncRange(now = new Date()): { rangeStart: Date; rangeEnd: Date } {
  const lookback = Math.max(0, Number(process.env.BIOMETRIC_SYNC_LOOKBACK_DAYS ?? 2));
  const end = utcMidnight(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - lookback);
  return { rangeStart: start, rangeEnd: end };
}
