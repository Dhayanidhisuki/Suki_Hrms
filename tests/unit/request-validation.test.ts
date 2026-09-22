import { describe, it, expect } from 'vitest';
import { mispunchRequestSchema, myLeaveApplicationSchema } from '@/lib/validations/workforce';

const reason = 'forgot to punch';

describe('mispunchRequestSchema', () => {
  it('rejects an out time earlier than the in time on the same day', () => {
    const r = mispunchRequestSchema.safeParse({
      date: '2026-09-01',
      requestedInTime: '2026-09-01T09:37',
      requestedOutTime: '2026-09-01T06:47',
      reason,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(JSON.stringify(r.error.issues)).toContain('Out time must be after in time');
  });

  it('rejects an out time equal to the in time', () => {
    const r = mispunchRequestSchema.safeParse({
      date: '2026-09-01',
      requestedInTime: '2026-09-01T09:00',
      requestedOutTime: '2026-09-01T09:00',
      reason,
    });
    expect(r.success).toBe(false);
  });

  it('accepts a normal day', () => {
    const r = mispunchRequestSchema.safeParse({
      date: '2026-09-01',
      requestedInTime: '2026-09-01T09:37',
      requestedOutTime: '2026-09-01T18:47',
      reason,
    });
    expect(r.success).toBe(true);
  });

  it('accepts a night shift whose out time falls on the next day', () => {
    const r = mispunchRequestSchema.safeParse({
      date: '2026-09-01',
      requestedInTime: '2026-09-01T22:00',
      requestedOutTime: '2026-09-02T06:00',
      reason,
    });
    expect(r.success).toBe(true);
  });

  it('still accepts a single-sided correction', () => {
    const r = mispunchRequestSchema.safeParse({
      date: '2026-09-01',
      requestedOutTime: '2026-09-01T18:47',
      reason,
    });
    expect(r.success).toBe(true);
  });

  it('rejects a future date', () => {
    const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    const r = mispunchRequestSchema.safeParse({
      date: nextYear,
      requestedInTime: `${nextYear}T09:00`,
      reason,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(JSON.stringify(r.error.issues)).toContain('future date');
  });
});

describe('myLeaveApplicationSchema', () => {
  it('rejects a reversed date range', () => {
    const r = myLeaveApplicationSchema.safeParse({
      leaveMasterId: 1,
      fromDate: '2026-09-10',
      toDate: '2026-09-05',
      numberOfDays: 1,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(JSON.stringify(r.error.issues)).toContain('on or after');
  });

  it('accepts a single-day application', () => {
    const r = myLeaveApplicationSchema.safeParse({
      leaveMasterId: 1,
      fromDate: '2026-09-05',
      toDate: '2026-09-05',
      numberOfDays: 1,
    });
    expect(r.success).toBe(true);
  });
});
