/**
 * Approved permission (short leave) excuses the late-coming / early-going it
 * was granted for.
 *
 * Without this, permission was invisible to the attendance calculation: an
 * employee with an approved hour of morning permission still recorded 60
 * late minutes and was charged LOM for them, and the same held for an
 * approved early departure. Approval changed nothing on the day, which is
 * the opposite of what granting permission means.
 *
 * Only `approved` requests excuse anything. A request still awaiting a
 * decision leaves the LOM standing — it drops to zero the moment it is
 * approved, and a rejected request means the LOM was correct all along.
 *
 * The excuse is capped at the hours actually granted, not the whole day:
 * 1 h of permission against a 2 h late arrival excuses 60 minutes and
 * leaves the other 60 chargeable. Anything else would let a 15-minute
 * request wipe out a three-hour absence.
 */

import { prisma } from './prisma';

/** Map key — one employee, one date. */
function key(employeeId: number, iso: string): string {
  return `${employeeId}|${iso}`;
}

export type PermissionExcuseMap = Map<string, number>;

/** Minutes excused for this employee on this date; 0 when there are none. */
export function excusedMinutesFor(
  map: PermissionExcuseMap,
  employeeId: number,
  date: Date | string
): number {
  const iso = typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  return map.get(key(employeeId, iso)) ?? 0;
}

/**
 * Approved permission minutes per employee per date across a window, in one
 * query. `employeeIds` empty means "every employee" — used by the screens
 * that list a whole company for a day or a month.
 */
export async function getApprovedPermissionMinutes(
  employeeIds: number[],
  from: Date,
  to: Date // exclusive
): Promise<PermissionExcuseMap> {
  const rows = await prisma.permissionRequest.findMany({
    where: {
      status: 'approved',
      date: { gte: from, lt: to },
      ...(employeeIds.length ? { employeeId: { in: employeeIds } } : {}),
    },
    select: { employeeId: true, date: true, hours: true },
  });

  const map: PermissionExcuseMap = new Map();
  for (const r of rows) {
    // More than one approved request can land on the same day (an hour in
    // the morning, half an hour in the evening) — they add up.
    const k = key(r.employeeId, r.date.toISOString().slice(0, 10));
    map.set(k, (map.get(k) ?? 0) + Math.round(Number(r.hours) * 60));
  }
  return map;
}
