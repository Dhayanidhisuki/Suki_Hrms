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
import { upsertDailyAttendanceWithHistory, isProtectedFromDeviceOverwrite, recordLeaveConflict } from './attendanceHistory';
import { notifyLeaveConflict, type LeaveConflictNotice } from './ess/notifyRequest';
import { isAttendanceLocked } from './attendanceFreeze';
import { buildWeeklyOffResolver, buildHolidayLookup } from './weeklyOff';
import {
  deriveStatusAndMinutes,
  resolveDailyShift,
  resolveDailyShiftWithOverride,
  resolveEmployeeShiftConfig,
  refreshMonthlySummary,
  type EmployeeShiftConfig,
} from './biometricConversion';

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
  /** Days left alone because a person had already corrected / approved them — see isProtectedFromDeviceOverwrite. */
  skippedProtected: number;
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

  // skippedProtected is not a BiometricSyncRun column (derived, reported in
  // the outcome only) — keep it out of the `counts` spread written to the run.
  const counts = { rowsFetched: 0, daysCreated: 0, daysUpdated: 0, daysUnchanged: 0, skippedFrozen: 0 };
  let skippedProtected = 0;
  const conflicts: LeaveConflictNotice[] = [];
  const unmatched = new Map<string, UnmatchedDeviceUser>();

  try {
    const days: ParsedDeviceDay[] = await fetchDeviceDailyAttendance(rangeStart, rangeEnd);
    counts.rowsFetched = days.length;

    const lookup = await buildEmployeeLookup(opts.companyId);
    const shiftConfigs = new Map<number, EmployeeShiftConfig>();
    const touchedMonths = new Set<string>();

    // Weekly-off / holiday flags: resolved once for the run, not per day.
    // The device range can carry an overnight out-punch one day past
    // rangeEnd, so the holiday window is padded by a day.
    const weeklyOff = await buildWeeklyOffResolver(opts.companyId, Array.from(new Set(lookup.values())));
    const holidayKeys = await buildHolidayLookup(
      opts.companyId,
      rangeStart,
      new Date(rangeEnd.getTime() + 24 * 60 * 60 * 1000)
    );

    // The device buckets punches by calendar date, so an overnight shift's
    // exit punch arrives as the NEXT day's firstIn rather than closing the
    // shift it belongs to. Left alone that produces two MissingPunch days
    // with zero worked minutes each — the person reads as absent on the
    // muster roll despite having worked all night. carryOvernightPunches
    // closes the first day with that punch, but only where the pairing is
    // unambiguous; see its contract for what it deliberately refuses.
    const carried = await carryOvernightPunches(days, lookup, shiftConfigs);

    for (const day of days) {
      if (carried.consumed.has(day)) continue; // punch already closed the previous day
      const employeeId = resolveDeviceUser(lookup, day.userid);
      if (!employeeId) {
        const key = day.userid;
        const u = unmatched.get(key) ?? { userid: day.userid, username: day.username, days: 0 };
        u.days += 1;
        unmatched.set(key, u);
        continue;
      }

      // Locked = FROZEN / READY_FOR_PAYROLL / payroll processed — never written.
      if (await isAttendanceLocked(employeeId, day.date)) {
        counts.skippedFrozen += 1;
        continue;
      }

      // A day a person already decided (manual entry, mispunch correction,
      // leave / on-duty / WFH approval) is not re-derived from the device.
      // Before this guard the 8-hourly sync flipped such days back to
      // whatever the device reported and undid the approval (audit A1).
      const existingRow = await prisma.dailyAttendance.findUnique({
        where: { employeeId_date: { employeeId, date: day.date } },
        select: { id: true, source: true, status: true, leaveApplicationId: true, leaveDayKind: true, leaveConflictInTime: true, leaveConflictOutTime: true },
      });
      const isHalfDayLeave = existingRow?.leaveApplicationId != null && existingRow.leaveDayKind === 'HALF';
      if (existingRow && !isHalfDayLeave && isProtectedFromDeviceOverwrite(existingRow, 'biometric')) {
        skippedProtected += 1;
        // A punch on an approved full leave day is a conflict for HR to
        // decide (leave core 2026-09-25), never applied silently.
        if (existingRow.leaveApplicationId != null) {
          const inTime = day.firstIn?.at ?? null;
          const outTime =
            carried.closes.get(day) ??
            (day.lastOut && day.firstIn && day.lastOut.at.getTime() !== day.firstIn.at.getTime() ? day.lastOut.at : null);
          if (await recordLeaveConflict(prisma, existingRow, { inTime, outTime, source: 'biometric' })) {
            conflicts.push({ employeeId, date: day.date, leaveApplicationId: existingRow.leaveApplicationId });
          }
        }
        continue;
      }

      let config = shiftConfigs.get(employeeId);
      if (!config) {
        config = await resolveEmployeeShiftConfig(employeeId);
        shiftConfigs.set(employeeId, config);
      }
      // Override-aware: an approved shift change / roster override for the
      // day must be what late, early-out and OT are measured against.
      const shift = await resolveDailyShiftWithOverride(employeeId, day.date, config);

      const inTime = day.firstIn?.at ?? null;
      // A single punch is not a pair — keep it as the in-punch and flag the day.
      const outTime =
        carried.closes.get(day) ??
        (day.lastOut && day.firstIn && day.lastOut.at.getTime() !== day.firstIn.at.getTime() ? day.lastOut.at : null);

      const derived = deriveStatusAndMinutes(null, inTime, outTime, shift, config.otThresholdMinutes, config.maxOtMinutesPerDay);

      if (isHalfDayLeave) {
        // Half-day leave: the worked half's punches merge into the day; it
        // stays HalfDay and never queues OT or LOM (the other half is leave).
        const result = await upsertDailyAttendanceWithHistory(
          prisma,
          employeeId,
          day.date,
          { inTime, outTime, workingMinutes: derived.workingMinutes, shiftMasterId: shift.shiftMasterId, otMinutesCalculated: 0, lateMinutes: 0, earlyOutMinutes: 0 },
          { userId: opts.triggeredByUserId ?? null, changedBySource: 'biometric' }
        );
        if (result.outcome === 'updated') counts.daysUpdated += 1;
        else counts.daysUnchanged += 1;
        touchedMonths.add(`${employeeId}:${day.date.getUTCFullYear()}-${day.date.getUTCMonth() + 1}`);
        continue;
      }

      const status = inTime && !outTime ? 'MissingPunch' : derived.status;

      // Same rule as the import path: any punch on a weekly off / holiday
      // flags the day so OT approval can offer comp-off settlement and the
      // day-type OT factor applies. Gated on "any punch", not both.
      const worked = Boolean(inTime || outTime) && status !== 'Absent';
      const isWeeklyOffWorked = worked && weeklyOff.isWeeklyOff(employeeId, day.date);
      const isHolidayWorked = worked && holidayKeys.has(day.date.toISOString().slice(0, 10));

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
          earlyOutMinutes: derived.earlyOutMinutes,
          source: 'biometric',
          shiftMasterId: shift.shiftMasterId,
          isWeeklyOffWorked,
          isHolidayWorked,
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

    // After the loop, never inside it: HR is told once per newly recorded
    // conflict, and a notification failure cannot fail the run.
    for (const c of conflicts) await notifyLeaveConflict(opts.companyId, c);

    const unmatchedList = Array.from(unmatched.values()).sort((a, b) => b.days - a.days);
    await prisma.biometricSyncRun.update({
      where: { id: run.id },
      data: { ...counts, status: 'success', unmatchedUserIds: JSON.stringify(unmatchedList), finishedAt: new Date() },
    });
    return { runId: run.id, status: 'success', ...counts, skippedProtected, unmatched: unmatchedList };
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
    return { runId: run.id, status: 'failed', ...counts, skippedProtected, unmatched: unmatchedList, error: message };
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

/**
 * How long after a night shift's scheduled end a lone next-morning punch may
 * still be read as that shift's exit. Deliberately tight: this value decides
 * only whether the pairing is made AUTOMATICALLY, never what anyone is paid.
 * Anything outside the window is left as MissingPunch for a human to resolve
 * through a mis-punch correction, so erring small costs an employee nothing
 * beyond raising a request — whereas erring large would silently invent a
 * punch pair, and with it working minutes and overtime.
 */
const OVERNIGHT_CARRY_GRACE_MINUTES = 120;

interface CarryResult {
  /** Day whose lone punch was consumed to close the previous day — skip it. */
  consumed: Set<ParsedDeviceDay>;
  /** Day -> the out-punch carried back from the following calendar day. */
  closes: Map<ParsedDeviceDay, Date>;
}

/**
 * Pairs an overnight shift's exit punch back onto the day it belongs to.
 *
 * Pairs ONLY when every one of these holds, because each rules out a case
 * where the punch could legitimately mean something else:
 *   1. The earlier day has an in-punch and no distinct out-punch.
 *   2. That day's roster shift is genuinely overnight (end < start). A
 *      morning shift running into the night is a double shift, not an
 *      overnight one — it needs review, not a silent pairing.
 *   3. The next day is the immediately following calendar date.
 *   4. The next day has exactly one punch. If it has a pair of its own it is
 *      a working day in its own right, and consuming its first punch would
 *      destroy that day's record.
 *   5. That punch lands after midnight and no later than the shift's
 *      scheduled end plus OVERNIGHT_CARRY_GRACE_MINUTES.
 *
 * Everything else is left alone on purpose. A double shift, a punch hours
 * past the shift end, or a next day with its own pair all stay MissingPunch
 * so a person decides — see docs/MISPUNCH_DATA_GUIDELINES.md.
 */
export async function carryOvernightPunches(
  days: ParsedDeviceDay[],
  lookup: Awaited<ReturnType<typeof buildEmployeeLookup>>,
  shiftConfigs: Map<number, EmployeeShiftConfig>
): Promise<CarryResult> {
  const consumed = new Set<ParsedDeviceDay>();
  const closes = new Map<ParsedDeviceDay, Date>();

  // Index by employee so "the next calendar day" means the next day for THAT
  // person, not the next row the device happened to return.
  const byEmployee = new Map<number, ParsedDeviceDay[]>();
  for (const d of days) {
    const employeeId = resolveDeviceUser(lookup, d.userid);
    if (!employeeId) continue;
    const list = byEmployee.get(employeeId) ?? [];
    list.push(d);
    byEmployee.set(employeeId, list);
  }

  for (const [employeeId, list] of byEmployee) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime());

    let config = shiftConfigs.get(employeeId);
    if (!config) {
      config = await resolveEmployeeShiftConfig(employeeId);
      shiftConfigs.set(employeeId, config);
    }

    for (let i = 0; i < list.length - 1; i++) {
      const day = list[i];
      const next = list[i + 1];

      // (1) unclosed day
      const hasDistinctOut =
        day.lastOut && day.firstIn && day.lastOut.at.getTime() !== day.firstIn.at.getTime();
      if (!day.firstIn || hasDistinctOut) continue;

      // (2) the roster shift for that day must itself be overnight
      const shift = resolveDailyShift(config, day.date);
      if (shift.startMinutes === null || shift.endMinutes === null) continue;
      if (shift.endMinutes >= shift.startMinutes) continue;

      // (3) immediately following calendar date
      if (next.date.getTime() - day.date.getTime() !== 24 * 60 * 60 * 1000) continue;

      // (4) the next day must hold exactly one punch
      const nextHasPair =
        next.lastOut && next.firstIn && next.lastOut.at.getTime() !== next.firstIn.at.getTime();
      if (!next.firstIn || nextHasPair) continue;

      // (5) that punch must plausibly close the night shift
      const punchMinutes = next.firstIn.at.getUTCHours() * 60 + next.firstIn.at.getUTCMinutes();
      if (punchMinutes > shift.endMinutes + OVERNIGHT_CARRY_GRACE_MINUTES) continue;

      closes.set(day, next.firstIn.at);
      consumed.add(next);
      i++; // the consumed day cannot also open a pair of its own
    }
  }

  return { consumed, closes };
}
