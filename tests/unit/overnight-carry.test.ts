import { describe, it, expect, vi } from 'vitest';

// resolveEmployeeShiftConfig hits the DB; the carry rule only needs the shift
// window, so stub the config and let resolveDailyShift run for real.
vi.mock('@/lib/biometricConversion', async () => {
  const actual = await vi.importActual<typeof import('@/lib/biometricConversion')>('@/lib/biometricConversion');
  return {
    ...actual,
    resolveEmployeeShiftConfig: vi.fn(),
    resolveDailyShift: vi.fn(),
  };
});

import { carryOvernightPunches } from '@/lib/biometricSync';
import { resolveDailyShift, resolveEmployeeShiftConfig } from '@/lib/biometricConversion';

const NIGHT = { shiftMasterId: 1, startMinutes: 22 * 60, endMinutes: 6 * 60, standardMinutes: 480, graceMinutes: 0 };
const MORNING = { shiftMasterId: 2, startMinutes: 9 * 60, endMinutes: 17 * 60 + 30, standardMinutes: 510, graceMinutes: 0 };

const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const at = (ymd: string, hh: number, mm = 0) => {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCHours(hh, mm, 0, 0);
  return d;
};

/** One device day. `out` omitted = a single unpaired punch. */
function deviceDay(ymd: string, inH: number, inM = 0, out?: { h: number; m?: number }) {
  return {
    userid: '105',
    username: 'Test',
    date: day(ymd),
    firstIn: { date: day(ymd), at: at(ymd, inH, inM) },
    lastOut: out ? { date: day(ymd), at: at(ymd, out.h, out.m ?? 0) } : null,
    eventCount: out ? 2 : 1,
  };
}

const lookup = new Map<string, number>([['105', 42]]);

function setShift(shift: typeof NIGHT | typeof MORNING) {
  (resolveEmployeeShiftConfig as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    otThresholdMinutes: 30,
    maxOtMinutesPerDay: 180,
  });
  (resolveDailyShift as unknown as ReturnType<typeof vi.fn>).mockReturnValue(shift);
}

describe('carryOvernightPunches', () => {
  it('closes a night shift with the lone next-morning punch', async () => {
    setShift(NIGHT);
    const d1 = deviceDay('2026-09-01', 22);
    const d2 = deviceDay('2026-09-02', 6);
    const r = await carryOvernightPunches([d1, d2], lookup, new Map());

    expect(r.closes.get(d1)?.toISOString()).toBe('2026-09-02T06:00:00.000Z');
    expect(r.consumed.has(d2)).toBe(true);
  });

  it('allows a late exit punch inside the grace window', async () => {
    setShift(NIGHT);
    const d1 = deviceDay('2026-09-01', 22);
    const d2 = deviceDay('2026-09-02', 7, 30); // 90 min past the 06:00 end
    const r = await carryOvernightPunches([d1, d2], lookup, new Map());
    expect(r.closes.has(d1)).toBe(true);
  });

  it('refuses a punch beyond the grace window — that is a double shift, not an exit', async () => {
    setShift(NIGHT);
    const d1 = deviceDay('2026-09-01', 22);
    const d2 = deviceDay('2026-09-02', 14); // worked on into the morning shift
    const r = await carryOvernightPunches([d1, d2], lookup, new Map());
    expect(r.closes.has(d1)).toBe(false);
    expect(r.consumed.has(d2)).toBe(false);
  });

  it('refuses to pair when the earlier day is a morning shift', async () => {
    setShift(MORNING); // morning running into the night = double shift
    const d1 = deviceDay('2026-09-01', 9, 42);
    const d2 = deviceDay('2026-09-02', 6);
    const r = await carryOvernightPunches([d1, d2], lookup, new Map());
    expect(r.closes.has(d1)).toBe(false);
  });

  it('refuses when the next day has a pair of its own', async () => {
    setShift(NIGHT);
    const d1 = deviceDay('2026-09-01', 22);
    const d2 = deviceDay('2026-09-02', 6, 0, { h: 14 }); // its own working day
    const r = await carryOvernightPunches([d1, d2], lookup, new Map());
    expect(r.closes.has(d1)).toBe(false);
    expect(r.consumed.has(d2)).toBe(false);
  });

  it('refuses when the days are not consecutive', async () => {
    setShift(NIGHT);
    const d1 = deviceDay('2026-09-01', 22);
    const d2 = deviceDay('2026-09-03', 6); // a day missing in between
    const r = await carryOvernightPunches([d1, d2], lookup, new Map());
    expect(r.closes.has(d1)).toBe(false);
  });

  it('leaves an already-complete day untouched', async () => {
    setShift(NIGHT);
    const d1 = deviceDay('2026-09-01', 22, 0, { h: 6 });
    const d2 = deviceDay('2026-09-02', 6);
    const r = await carryOvernightPunches([d1, d2], lookup, new Map());
    expect(r.closes.has(d1)).toBe(false);
    expect(r.consumed.has(d2)).toBe(false);
  });

  it('does not let one punch close two days', async () => {
    setShift(NIGHT);
    const d1 = deviceDay('2026-09-01', 22);
    const d2 = deviceDay('2026-09-02', 6);
    const d3 = deviceDay('2026-09-03', 6);
    const r = await carryOvernightPunches([d1, d2, d3], lookup, new Map());
    expect(r.closes.size).toBe(1);
    expect(r.consumed.size).toBe(1);
  });

  it('ignores device users that match no employee', async () => {
    setShift(NIGHT);
    const d1 = { ...deviceDay('2026-09-01', 22), userid: '999' };
    const d2 = { ...deviceDay('2026-09-02', 6), userid: '999' };
    const r = await carryOvernightPunches([d1, d2], lookup, new Map());
    expect(r.closes.size).toBe(0);
  });
});
