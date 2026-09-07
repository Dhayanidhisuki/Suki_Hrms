import { describe, it, expect } from 'vitest';
import {
  calculateProbationEndDate,
  applyEmployeeFieldChange,
  applyContactFieldChange,
} from '@/lib/employee-form-fields';

describe('calculateProbationEndDate', () => {
  it('adds the probation months to the join date', () => {
    const result = calculateProbationEndDate('2026-01-01', 6);
    expect(result?.toISOString().slice(0, 10)).toBe('2026-07-01');
  });

  it('returns null when join date is missing', () => {
    expect(calculateProbationEndDate(null, 6)).toBeNull();
    expect(calculateProbationEndDate(undefined, 6)).toBeNull();
  });

  it('returns null when probation months is missing or zero', () => {
    expect(calculateProbationEndDate('2026-01-01', null)).toBeNull();
    expect(calculateProbationEndDate('2026-01-01', 0)).toBeNull();
  });

  it('returns null for an unparseable join date', () => {
    expect(calculateProbationEndDate('not-a-date', 6)).toBeNull();
  });
});

describe('applyEmployeeFieldChange', () => {
  it('live-recomputes probationEndDate when joinDate changes', () => {
    const next = applyEmployeeFieldChange({ probationPeriodMonths: 3 }, 'joinDate', '2026-02-01');
    expect(next.probationEndDate).toBe('2026-05-01');
  });

  it('live-recomputes probationEndDate when probationPeriodMonths changes', () => {
    const next = applyEmployeeFieldChange({ joinDate: '2026-02-01' }, 'probationPeriodMonths', 9);
    expect(next.probationEndDate).toBe('2026-11-01');
  });

  it('clears probationEndDate when the computation is no longer possible', () => {
    const next = applyEmployeeFieldChange({ joinDate: '2026-02-01' }, 'probationPeriodMonths', 0);
    expect(next.probationEndDate).toBeUndefined();
  });

  it('does not touch probationEndDate for unrelated fields', () => {
    const next = applyEmployeeFieldChange({ probationEndDate: '2026-05-01' }, 'firstName', 'Priya');
    expect(next.probationEndDate).toBe('2026-05-01');
  });
});

describe('applyContactFieldChange (Present Same as Permanent)', () => {
  it('copies permanent address fields into present fields when the checkbox is turned on', () => {
    const next = applyContactFieldChange(
      { permanentAddressLine1: '12 MG Road', permanentCity: 'Chennai' },
      'sameAsPermanent',
      true
    );
    expect(next.presentAddressLine1).toBe('12 MG Road');
    expect(next.presentCity).toBe('Chennai');
  });

  it('live-mirrors a permanent field edit into present when already checked', () => {
    const next = applyContactFieldChange(
      { sameAsPermanent: true, permanentCity: 'Chennai' },
      'permanentCity',
      'Coimbatore'
    );
    expect(next.presentCity).toBe('Coimbatore');
  });

  it('does not touch present fields when unchecked', () => {
    const next = applyContactFieldChange(
      { permanentCity: 'Chennai', presentCity: 'Mumbai' },
      'permanentCity',
      'Coimbatore'
    );
    expect(next.presentCity).toBe('Mumbai');
  });
});
