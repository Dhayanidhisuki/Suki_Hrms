/**
 * Mobile-app attendance sync: reads the app database's punch tables
 * (src/lib/appAttendanceDb.ts) for a date range, records each day's app
 * contribution in AttendanceSourceDay, and re-runs the shared merge
 * (src/lib/attendanceMerge.ts) so the final DailyAttendance row always
 * reflects BOTH feeds — earliest in / latest out.
 *
 * Mirrors runBiometricSync deliberately: same run-log shape, same employee
 * matching (Employee.oldEmployeeCode via normaliseDeviceUserId), same
 * unmatched-ID reporting. Runs on the combined scheduler tick and on
 * demand from POST /api/workforce/attendance/app-sync.
 *
 * A failed connection or query marks the run 'failed' and touches NO
 * attendance rows — an unreachable app database is never treated as "the
 * app had no punches".
 */

import { prisma } from './prisma';
import { fetchAppAttendance } from './appAttendanceDb';
import { buildEmployeeLookup, resolveDeviceUser } from './biometricSync';
import { recordSourceContribution, reconcileAttendanceDay } from './attendanceMerge';
import { refreshMonthlySummary, type EmployeeShiftConfig, resolveEmployeeShiftConfig } from './biometricConversion';
import type { SyncOutcome, UnmatchedDeviceUser } from './biometricSync';

export interface AppSyncOptions {
  companyId: number;
  rangeStart: Date; // UTC midnight, inclusive
  rangeEnd: Date; // UTC midnight, inclusive
  trigger: 'scheduled' | 'manual';
  triggeredByUserId?: number | null;
}

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function runAppSync(opts: AppSyncOptions): Promise<SyncOutcome & { skippedProtected: number; needsReview: number }> {
  const rangeStart = utcMidnight(opts.rangeStart);
  const rangeEnd = utcMidnight(opts.rangeEnd);

  const run = await prisma.attendanceSyncRun.create({
    data: {
      companyId: opts.companyId,
      source: 'app',
      trigger: opts.trigger,
      rangeStart,
      rangeEnd,
      triggeredByUserId: opts.triggeredByUserId ?? null,
    },
  });

  const counts = {
    rowsFetched: 0,
    daysCreated: 0,
    daysUpdated: 0,
    daysUnchanged: 0,
    skippedFrozen: 0,
    skippedProtected: 0,
    needsReview: 0,
  };
  const unmatched = new Map<string, UnmatchedDeviceUser>();

  try {
    const days = await fetchAppAttendance(rangeStart, rangeEnd);
    counts.rowsFetched = days.length;

    const lookup = await buildEmployeeLookup(opts.companyId);
    const shiftConfigs = new Map<number, EmployeeShiftConfig>();
    const touchedMonths = new Set<string>();

    for (const day of days) {
      const employeeId = resolveDeviceUser(lookup, day.empCd);
      if (!employeeId) {
        const u = unmatched.get(day.empCd) ?? { userid: day.empCd, username: '', days: 0 };
        u.days += 1;
        unmatched.set(day.empCd, u);
        continue;
      }

      let config = shiftConfigs.get(employeeId);
      if (!config) {
        config = await resolveEmployeeShiftConfig(employeeId);
        shiftConfigs.set(employeeId, config);
      }

      // Record the app source's contribution, then re-run the merge — the
      // merge decides what the final row becomes from BOTH sources.
      await recordSourceContribution(prisma, employeeId, day.date, 'app', {
        inTime: day.inTime,
        outTime: day.outTime,
        inLatitude: day.inLatitude,
        inLongitude: day.inLongitude,
        outLatitude: day.outLatitude,
        outLongitude: day.outLongitude,
        sourceRowId: day.rowId,
      });

      const outcome = await reconcileAttendanceDay(prisma, employeeId, day.date, {
        companyId: opts.companyId,
        userId: opts.triggeredByUserId ?? null,
        shiftConfig: config,
      });

      if (outcome === 'created') counts.daysCreated += 1;
      else if (outcome === 'updated') counts.daysUpdated += 1;
      else if (outcome === 'unchanged') counts.daysUnchanged += 1;
      else if (outcome === 'skipped_locked_month') counts.skippedFrozen += 1;
      else if (outcome === 'needs_review') counts.needsReview += 1;

      touchedMonths.add(`${employeeId}:${day.date.getUTCFullYear()}-${day.date.getUTCMonth() + 1}`);
    }

    for (const key of touchedMonths) {
      const [emp, ym] = key.split(':');
      const [y, m] = ym.split('-').map(Number);
      await refreshMonthlySummary(Number(emp), y, m);
    }

    const unmatchedList = Array.from(unmatched.values()).sort((a, b) => b.days - a.days);
    await prisma.attendanceSyncRun.update({
      where: { id: run.id },
      data: { ...counts, status: 'success', unmatchedUserIds: JSON.stringify(unmatchedList), finishedAt: new Date() },
    });
    // At a per-minute cadence identical scheduled runs are pure noise —
    // drop the previous run row when this one produced the same outcome,
    // so the log keeps one row per state change (latest timestamp wins).
    if (opts.trigger === 'scheduled') {
      const prev = await prisma.attendanceSyncRun.findFirst({
        where: { id: { not: run.id }, source: 'app', trigger: 'scheduled', status: 'success' },
        orderBy: { id: 'desc' },
      });
      if (
        prev &&
        prev.rowsFetched === counts.rowsFetched &&
        prev.daysCreated === counts.daysCreated &&
        prev.daysUpdated === counts.daysUpdated &&
        prev.daysUnchanged === counts.daysUnchanged &&
        prev.skippedFrozen === counts.skippedFrozen &&
        prev.skippedProtected === counts.skippedProtected &&
        prev.needsReview === counts.needsReview &&
        prev.unmatchedUserIds === JSON.stringify(unmatchedList)
      ) {
        await prisma.attendanceSyncRun.delete({ where: { id: prev.id } }).catch(() => {});
      }
    }
    return { runId: run.id, status: 'success', ...counts, unmatched: unmatchedList };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const unmatchedList = Array.from(unmatched.values());
    await prisma.attendanceSyncRun
      .update({
        where: { id: run.id },
        data: { ...counts, status: 'failed', error: message.slice(0, 2000), unmatchedUserIds: JSON.stringify(unmatchedList), finishedAt: new Date() },
      })
      .catch(() => {});
    console.error('[app-sync] run failed', { runId: run.id, message });
    return { runId: run.id, status: 'failed', ...counts, unmatched: unmatchedList, error: message };
  }
}
