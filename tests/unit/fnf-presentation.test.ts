import { describe, it, expect } from 'vitest';
import { formatServicePeriod, splitStatementLines } from '@/lib/fnf/presentation';

describe('F&F statement presentation', () => {
  it('formats years of service like the KUN overview', () => {
    expect(formatServicePeriod(new Date(Date.UTC(2014, 0, 1)), new Date(Date.UTC(2026, 0, 1)))).toBe(
      '12 Years, 0 Months',
    );
    expect(formatServicePeriod(new Date(Date.UTC(2014, 7, 11)), new Date(Date.UTC(2026, 7, 5)))).toBe(
      '11 Years, 11 Months',
    );
  });

  it('keeps leave/gratuity/bonus/incentive off the salary column', () => {
    const split = splitStatementLines([
      { kind: 'EARNING', code: 'SAL_BASIC', name: 'Basic', amount: 5000 },
      { kind: 'EARNING', code: 'LEAVE_ENCASHMENT', name: 'Leave', amount: 1000 },
      { kind: 'DEDUCTION', code: 'PF', name: 'PF', amount: 80 },
    ]);
    expect(split.salaryEarnings).toHaveLength(1);
    expect(split.otherEarnings.map((l) => l.code)).toEqual(['LEAVE_ENCASHMENT']);
    expect(split.deductions).toHaveLength(1);
  });
});
