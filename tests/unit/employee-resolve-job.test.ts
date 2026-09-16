import { describe, it, expect } from 'vitest';
import {
  utcDay,
  addDays,
  daysBetweenInclusive,
  pickRowAsOn,
  splitPeriodByRows,
  resolveRowsForPeriod,
  backdateAllowanceDays,
} from '@/lib/employee/resolveJob';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// BRD 01 §15.5 worked example: EMP026 transferred with effect from 16-May-2026.
const rows = [
  { id: 1, effectiveFrom: d('2023-08-01'), effectiveTo: d('2026-05-15'), location: 'LOC-HSR1-P1', dept: 'DEP-PRD', cc: 'CC-3100', manager: 'EMP011' },
  { id: 2, effectiveFrom: d('2026-05-16'), effectiveTo: null, location: 'LOC-HSR2-P2', dept: 'DEP-QLY', cc: 'CC-3200', manager: 'EMP019' },
];

describe('resolveJob — date helpers', () => {
  it('normalises to the UTC calendar day', () => {
    expect(utcDay(new Date('2026-09-11T08:15:07.546Z')).toISOString()).toBe('2026-09-11T00:00:00.000Z');
  });
  it('adds days and counts inclusive spans', () => {
    expect(addDays(d('2026-05-16'), -1).toISOString()).toBe('2026-05-15T00:00:00.000Z');
    expect(daysBetweenInclusive(d('2026-05-01'), d('2026-05-31'))).toBe(31);
    expect(daysBetweenInclusive(d('2026-05-01'), d('2026-05-01'))).toBe(1);
    expect(daysBetweenInclusive(d('2026-05-02'), d('2026-05-01'))).toBe(0);
  });
});

describe('resolveJob — point-in-time (§15.4 / §15.5)', () => {
  it('attendance register for 12-May-2026 resolves to Production at Hosur Plant 1', () => {
    const row = pickRowAsOn(rows, d('2026-05-12'));
    expect(row?.dept).toBe('DEP-PRD');
    expect(row?.location).toBe('LOC-HSR1-P1');
  });
  it('leave applied 08-May resolves the approver EMP011, not the current manager', () => {
    expect(pickRowAsOn(rows, d('2026-05-08'))?.manager).toBe('EMP011');
  });
  it('boundary days belong to the right row (inclusive effectiveTo)', () => {
    expect(pickRowAsOn(rows, d('2026-05-15'))?.id).toBe(1);
    expect(pickRowAsOn(rows, d('2026-05-16'))?.id).toBe(2);
  });
  it('returns null before the date of joining', () => {
    expect(pickRowAsOn(rows, d('2023-07-31'))).toBeNull();
  });
  it('ignores a superseded row (effectiveTo before effectiveFrom) and a future-dated row', () => {
    const withExtra = [
      ...rows,
      { id: 3, effectiveFrom: d('2026-05-16'), effectiveTo: d('2026-05-15'), location: 'X', dept: 'X', cc: 'X', manager: 'X' },
      { id: 4, effectiveFrom: d('2027-01-01'), effectiveTo: null, location: 'F', dept: 'F', cc: 'F', manager: 'F' },
    ];
    expect(pickRowAsOn(withExtra, d('2026-05-20'))?.id).toBe(2);
    expect(pickRowAsOn(withExtra, d('2027-01-01'))?.id).toBe(4);
  });
});

describe('resolvePeriod modes — May 2026 report for EMP026 (§15.5)', () => {
  const from = d('2026-05-01');
  const to = d('2026-05-31');

  it('AS_ON_END: headcount on 31-May counts once under Quality', () => {
    const out = resolveRowsForPeriod(rows, from, to, 'AS_ON_END');
    expect(out).toHaveLength(1);
    expect(out[0].row.dept).toBe('DEP-QLY');
    expect(out[0].days).toBe(31);
  });
  it('AS_ON_START: value on 1-May is Production', () => {
    const out = resolveRowsForPeriod(rows, from, to, 'AS_ON_START');
    expect(out[0].row.dept).toBe('DEP-PRD');
  });
  it('DAY_WEIGHTED: 15/31 to CC-3100 and 16/31 to CC-3200', () => {
    const out = splitPeriodByRows(rows, from, to);
    expect(out.map((e) => [e.row.cc, e.days])).toEqual([
      ['CC-3100', 15],
      ['CC-3200', 16],
    ]);
    const gross = 46500;
    expect(Math.round((gross * out[0].days) / 31)).toBe(22500);
    expect(Math.round((gross * out[1].days) / 31)).toBe(24000);
    expect(resolveRowsForPeriod(rows, from, to, 'DAY_WEIGHTED')).toEqual(out);
  });
  it('PREDOMINANT: the row held for the most days (Quality, 16 days)', () => {
    const out = resolveRowsForPeriod(rows, from, to, 'PREDOMINANT');
    expect(out).toHaveLength(1);
    expect(out[0].row.cc).toBe('CC-3200');
    expect(out[0].days).toBe(16);
  });
  it('defaults to AS_ON_END', () => {
    expect(resolveRowsForPeriod(rows, from, to)[0].row.dept).toBe('DEP-QLY');
  });
  it('a period entirely inside one row splits to that row only', () => {
    const out = splitPeriodByRows(rows, d('2026-04-01'), d('2026-04-30'));
    expect(out).toEqual([{ row: rows[0], days: 30 }]);
  });
});

describe('changeJob back-dating allowance (§15.1)', () => {
  it('is 90 days for job attributes and 30 days when location or reporting is touched', () => {
    expect(backdateAllowanceDays({ departmentId: 1 })).toBe(90);
    expect(backdateAllowanceDays({ locationId: 1 })).toBe(30);
    expect(backdateAllowanceDays({}, { primaryManagerId: 5 })).toBe(30);
    expect(backdateAllowanceDays({ gradeId: 2 }, {})).toBe(90);
  });
});
