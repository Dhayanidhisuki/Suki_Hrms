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
