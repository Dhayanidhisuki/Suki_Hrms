import { describe, expect, it } from 'vitest';
import { currentFinancialYear } from '@/lib/performance/kra';
import { achievementPct, validateTargetForType } from '@/lib/performance/measurement';
import { validateKpiDates, validateWeightages } from '@/lib/performance/weightage';

describe('currentFinancialYear', () => {
  it('uses April start', () => {
    expect(currentFinancialYear(new Date(Date.UTC(2026, 3, 1)))).toBe('2026-27');
    expect(currentFinancialYear(new Date(Date.UTC(2026, 2, 31)))).toBe('2025-26');
  });
});

describe('achievementPct — BRD §10', () => {
  it('Method 1: higher is better = actual / target', () => {
    expect(achievementPct('HIGHER_IS_BETTER', 100, 90)).toBe(90);
  });

  it('Method 2: lower is better = target / actual', () => {
    // BRD §10 worked example: target 5 days, actual 4 days → 125% raw.
    // The default §23 cap of 120% then clips it, so lift the cap to see the raw figure.
    expect(achievementPct('LOWER_IS_BETTER', 5, 4, { minAchievementPct: 0, maxAchievementPct: 200 })).toBe(125);
    expect(achievementPct('LOWER_IS_BETTER', 5, 4)).toBe(120);
  });

  it('caps at the configured maximum — BRD §23', () => {
    expect(achievementPct('HIGHER_IS_BETTER', 100, 150)).toBe(120);
    expect(achievementPct('HIGHER_IS_BETTER', 100, 150, { minAchievementPct: 0, maxAchievementPct: 100 })).toBe(100);
  });

  it('returns null rather than Infinity on a zero divisor', () => {
    expect(achievementPct('HIGHER_IS_BETTER', 0, 90)).toBeNull();
    expect(achievementPct('LOWER_IS_BETTER', 5, 0)).toBeNull();
  });
});

describe('validateTargetForType', () => {
  it('holds a rating KPI to 1-5', () => {
    expect(validateTargetForType('RATING_1_5', 4)).toBeNull();
    expect(validateTargetForType('RATING_1_5', 7)).toMatch(/between 1 and 5/);
  });

  it('rejects a non-positive target on achievement types', () => {
    expect(validateTargetForType('HIGHER_IS_BETTER', 0)).toMatch(/greater than 0/);
  });
});

describe('validateWeightages — BRD §17 Model A', () => {
  const valid = [
    { label: 'Delivery', weightage: 60, kpis: [{ label: 'Project Delivery', weightage: 70 }, { label: 'Sprint', weightage: 30 }] },
    { label: 'Quality', weightage: 40, kpis: [{ label: 'Defect Rate', weightage: 100 }] },
  ];

  it('accepts 100% across KRAs and 100% within each KRA', () => {
    expect(validateWeightages(valid).valid).toBe(true);
  });

  it('rejects a KRA total that is not 100', () => {
    const r = validateWeightages([{ ...valid[0], weightage: 50 }, valid[1]]);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => /Total KRA weightage must be 100/.test(e))).toBe(true);
  });

  it('rejects KPI weights that do not total 100 within one KRA', () => {
    const r = validateWeightages([
      { label: 'Delivery', weightage: 100, kpis: [{ label: 'A', weightage: 60 }, { label: 'B', weightage: 30 }] },
    ]);
    expect(r.valid).toBe(false);
    expect(r.kpiTotals.Delivery).toBe(90);
  });

  it('rejects a KRA with no KPIs', () => {
    const r = validateWeightages([{ label: 'Empty', weightage: 100, kpis: [] }]);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('KRA "Empty" has no KPIs');
  });

  it('does not trip on 2dp rounding', () => {
    const third = [
      { label: 'A', weightage: 33.33, kpis: [{ label: 'a', weightage: 100 }] },
      { label: 'B', weightage: 33.33, kpis: [{ label: 'b', weightage: 100 }] },
      { label: 'C', weightage: 33.34, kpis: [{ label: 'c', weightage: 100 }] },
    ];
    expect(validateWeightages(third).valid).toBe(true);
  });
});

describe('validateKpiDates — BRD §41', () => {
  const cycle = { startDate: new Date('2026-04-01'), endDate: new Date('2027-03-31') };

  it('accepts a window inside the cycle', () => {
    expect(validateKpiDates([{ label: 'A', startDate: new Date('2026-04-01'), endDate: new Date('2027-03-31') }], cycle)).toEqual([]);
  });

  it('rejects a start before the cycle start and an end after the cycle end', () => {
    const errs = validateKpiDates([{ label: 'A', startDate: new Date('2026-03-01'), endDate: new Date('2027-04-30') }], cycle);
    expect(errs).toHaveLength(2);
  });

  it('rejects an inverted window', () => {
    const errs = validateKpiDates([{ label: 'A', startDate: new Date('2026-06-01'), endDate: new Date('2026-05-01') }], cycle);
    expect(errs[0]).toMatch(/end date is before start date/);
  });
});
