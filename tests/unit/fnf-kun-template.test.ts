import { describe, it, expect } from 'vitest';
import { amountInWordsInr } from '@/lib/fnf/amount-in-words';
import { earningTemplateLabel, fyBounds, formatKunDate, formatKunMonth } from '@/lib/fnf/kun-statement';

describe('KUN F&F template helpers', () => {
  it('writes net payable in Indian rupees words like the Excel sheet', () => {
    expect(amountInWordsInr(139182.32)).toBe(
      'Rupees One Lakh Thirty Nine Thousand One Hundred and Eighty Two only.',
    );
  });

  it('maps salary component codes onto the Excel earning labels', () => {
    expect(earningTemplateLabel('BASIC', 'Basic')).toBe('Basic Salary');
    expect(earningTemplateLabel('AHRA', 'Additional HRA')).toBe('Add. HRA');
    expect(earningTemplateLabel('MED_ALLOW', 'Medical')).toBe('Medical Allowances');
  });

  it('titles the FY from LWD in April-March years', () => {
    expect(fyBounds(new Date(Date.UTC(2026, 0, 30)))).toEqual({ start: 2025, end: 2026 });
    expect(formatKunMonth(2026, 1)).toBe('Jan-2026');
    expect(formatKunDate(new Date(Date.UTC(2012, 4, 1)))).toBe('01-05-2012');
  });
});
