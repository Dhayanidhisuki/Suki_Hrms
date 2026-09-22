import { describe, it, expect } from 'vitest';
import {
  applyMonthlyOtCap,
  computeAttendanceMetrics,
  computeLomMinutes,
  computeOtPayableMinutes,
} from '@/lib/attendanceCalc';

const shift = { startTime: '09:00', endTime: '17:30', graceMinutes: 15 };

describe('computeLomMinutes', () => {
  it('applies shift grace to late only: 09:40 on a 09:00/15m shift is 25 raw late -> 10 LOM', () => {
    // Raw late is stored as inTime - shiftStart (25), grace is applied here once.
    expect(computeLomMinutes(25, 0, shift, null)).toBe(10);
  });

  it('adds early-out without applying grace to it', () => {
    // 25 raw late -> 10 after grace, plus 20 early-out untouched -> 30.
    expect(computeLomMinutes(25, 20, shift, null)).toBe(30);
    // Early-out alone, well under the grace, is still fully counted.
    expect(computeLomMinutes(0, 5, shift, null)).toBe(5);
  });

  it('never goes negative when late is within grace', () => {
    expect(computeLomMinutes(10, 0, shift, null)).toBe(0);
  });

  it('falls back to the company LOM grace when no shift is linked', () => {
    expect(computeLomMinutes(25, 0, null, { graceMinutesExempt: 10 })).toBe(15);
  });

  it('applies the daily LOM cap; null cap means no cap', () => {
    expect(computeLomMinutes(120, 60, shift, { graceMinutesExempt: 0, dailyLomCap: 60 })).toBe(60);
    expect(computeLomMinutes(120, 60, shift, { graceMinutesExempt: 0, dailyLomCap: null })).toBe(165);
  });

  it('excuses approved permission minutes, capped at what was granted', () => {
    // Morning permission: 09:00 shift, in at 10:00 -> 60 raw late, 45 after
    // the 15m grace. One approved hour of permission wipes it out.
    expect(computeLomMinutes(60, 0, shift, null, 60)).toBe(0);
    // Early going: left 60 min early, one approved hour -> nothing charged.
    expect(computeLomMinutes(0, 60, shift, null, 60)).toBe(0);
    // Two hours late on one approved hour: only the granted hour is excused,
    // the rest stays chargeable (105 after grace - 60 = 45).
    expect(computeLomMinutes(120, 0, shift, null, 60)).toBe(45);
    // A permission longer than the lateness never produces a credit.
    expect(computeLomMinutes(20, 0, shift, null, 120)).toBe(0);
  });

  it('leaves LOM untouched when there is no approved permission', () => {
    // A pending or rejected request contributes 0 excused minutes, so the
    // day is charged exactly as it was before permission existed.
    expect(computeLomMinutes(60, 0, shift, null, 0)).toBe(45);
    expect(computeLomMinutes(60, 0, shift, null)).toBe(45);
  });

  it('applies the daily cap to what is left after permission, not before', () => {
    // 120 late (no grace) + 60 early = 180 raw, 60 excused -> 120, capped 90.
    expect(computeLomMinutes(120, 60, shift, { graceMinutesExempt: 0, dailyLomCap: 90 }, 60)).toBe(90);
  });

  it('agrees with the raw late stored by computeAttendanceMetrics (grace applied exactly once)', () => {
    // 09:25 punch -> 25 raw late stored -> 10 LOM after the 15m grace.
    const a = computeAttendanceMetrics('2026-09-01T09:25:00.000Z', '2026-09-01T17:30:00.000Z', shift);
    expect(a.lateMinutes).toBe(25);
    expect(computeLomMinutes(a.lateMinutes, a.earlyOutMinutes, shift, null)).toBe(10);
    // 09:40 punch -> 40 raw late stored -> 25 LOM. If storage had already
    // subtracted grace (25) this would come out as 10, i.e. grace twice.
    const b = computeAttendanceMetrics('2026-09-01T09:40:00.000Z', '2026-09-01T17:30:00.000Z', shift);
    expect(b.lateMinutes).toBe(40);
    expect(computeLomMinutes(b.lateMinutes, b.earlyOutMinutes, shift, null)).toBe(25);
  });
});

describe('computeOtPayableMinutes (per-day threshold + cap)', () => {
  it('pays nothing below the qualification threshold, full raw at or above it', () => {
    const plan = { applicableAfterMinutes: 30, maxOtHoursPerDay: null };
    expect(computeOtPayableMinutes(29, plan)).toBe(0);
    expect(computeOtPayableMinutes(30, plan)).toBe(30);
  });

  it('treats a null daily cap as no cap (not 180 minutes)', () => {
    expect(computeOtPayableMinutes(300, { applicableAfterMinutes: 0, maxOtHoursPerDay: null })).toBe(300);
    expect(computeOtPayableMinutes(300, { applicableAfterMinutes: 0 })).toBe(300);
    expect(computeOtPayableMinutes(300, null)).toBe(300);
  });

  it('caps at maxOtHoursPerDay when set', () => {
    expect(computeOtPayableMinutes(300, { applicableAfterMinutes: 0, maxOtHoursPerDay: 3 })).toBe(180);
    expect(computeOtPayableMinutes(120, { applicableAfterMinutes: 0, maxOtHoursPerDay: 3 })).toBe(120);
  });

  describe('wall-clock rounding slab', () => {
    // Shift ends 17:30 (5:30pm) -> 1050 minutes from midnight, for every case below.
    const shiftEnd530pm = 17 * 60 + 30;

    it('floors to the last completed wall-clock mark, not N minutes from shift-end', () => {
      const plan30 = { applicableAfterMinutes: 20, maxOtHoursPerDay: null, roundingSlabMinutes: 30 };
      // Checkout 6:28pm (58 raw min) -> last :00/:30 mark before 6:28 is 6:00 -> 30 min OT.
      expect(computeOtPayableMinutes(58, plan30, shiftEnd530pm)).toBe(30);
      // Checkout 6:15pm (45 raw min) -> last mark is still 6:00 -> 30 min OT.
      expect(computeOtPayableMinutes(45, plan30, shiftEnd530pm)).toBe(30);
      // Checkout 6:38pm (68 raw min) -> last mark is 6:30 -> 60 min OT.
      expect(computeOtPayableMinutes(68, plan30, shiftEnd530pm)).toBe(60);
    });

    it('works with a 15-minute slab', () => {
      const plan15 = { applicableAfterMinutes: 20, maxOtHoursPerDay: null, roundingSlabMinutes: 15 };
      // Checkout 6:22pm (52 raw min) -> last :00/:15/:30/:45 mark is 6:15 -> 45 min OT.
      expect(computeOtPayableMinutes(52, plan15, shiftEnd530pm)).toBe(45);
      // Checkout 6:14pm (44 raw min) -> last mark is 6:00 -> 30 min OT.
      expect(computeOtPayableMinutes(44, plan15, shiftEnd530pm)).toBe(30);
    });

    it('works with a 60-minute slab, which is where it diverges most from raw-elapsed flooring', () => {
      const plan60 = { applicableAfterMinutes: 20, maxOtHoursPerDay: null, roundingSlabMinutes: 60 };
      // Checkout 6:54pm (84 raw min) -> last top-of-hour mark before 6:54 is 6:00 -> 30 min OT
      // (NOT 60, which a naive floor(84/60)*60 from shift-end would give).
      expect(computeOtPayableMinutes(84, plan60, shiftEnd530pm)).toBe(30);
      // Checkout 7:24pm (114 raw min) -> last top-of-hour mark is 7:00 -> 90 min OT.
      expect(computeOtPayableMinutes(114, plan60, shiftEnd530pm)).toBe(90);
    });

    it('still applies the qualification threshold before rounding', () => {
      const plan60 = { applicableAfterMinutes: 90, maxOtHoursPerDay: null, roundingSlabMinutes: 60 };
      // 84 raw min is below the 90-min threshold -> 0, even though it would round to a nonzero value.
      expect(computeOtPayableMinutes(84, plan60, shiftEnd530pm)).toBe(0);
    });

    it('falls back to raw minutes (no rounding) when the shift end time-of-day is not supplied', () => {
      const plan60 = { applicableAfterMinutes: 20, maxOtHoursPerDay: null, roundingSlabMinutes: 60 };
      expect(computeOtPayableMinutes(84, plan60)).toBe(84);
    });

    it('still applies the daily cap after rounding', () => {
      const plan60 = { applicableAfterMinutes: 20, maxOtHoursPerDay: 1, roundingSlabMinutes: 60 };
      // Rounds to 90 min, then capped to 60 (1 hour).
      expect(computeOtPayableMinutes(114, plan60, shiftEnd530pm)).toBe(60);
    });
  });
});

describe('applyMonthlyOtCap', () => {
  it('scales the amount in step with the capped hours', () => {
    // 50h at a blended 100/h = 5000; cap 40h -> 40h and 4000.
    const r = applyMonthlyOtCap(50, 5000, 40);
    expect(r.totalOtHours).toBe(40);
    expect(r.totalOtAmount).toBeCloseTo(4000, 6);
  });

  it('leaves hours and amount alone when under the cap or when the cap is null', () => {
    expect(applyMonthlyOtCap(30, 3000, 40)).toEqual({ totalOtHours: 30, totalOtAmount: 3000 });
    expect(applyMonthlyOtCap(50, 5000, null)).toEqual({ totalOtHours: 50, totalOtAmount: 5000 });
    expect(applyMonthlyOtCap(50, 5000, undefined)).toEqual({ totalOtHours: 50, totalOtAmount: 5000 });
  });

  it('handles zero hours without dividing by zero', () => {
    expect(applyMonthlyOtCap(0, 0, 40)).toEqual({ totalOtHours: 0, totalOtAmount: 0 });
  });
});
