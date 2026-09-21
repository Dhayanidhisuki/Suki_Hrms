import { describe, expect, it } from 'vitest';
import { nextTemplateCode } from '@/lib/performance/templateCode';
import { canReissueAssignment } from '@/lib/performance/copyTemplate';
import { validateWeightages } from '@/lib/performance/weightage';

describe('nextTemplateCode', () => {
  it('starts at GT-0001 when none exist', () => {
    expect(nextTemplateCode([])).toBe('GT-0001');
  });

  it('increments the highest GT-NNNN', () => {
    expect(nextTemplateCode(['GT-0001', 'GT-0007', 'OTHER'])).toBe('GT-0008');
  });

  it('is case-insensitive on the GT- prefix', () => {
    expect(nextTemplateCode(['gt-3'])).toBe('GT-0004');
  });

  it('ignores unrelated codes', () => {
    expect(nextTemplateCode(['SALES-TPL'])).toBe('GT-0001');
  });
});

describe('template weightage gate — Model A', () => {
  it('names the KRA whose KPI weights are off', () => {
    const r = validateWeightages([
      { label: 'REV', weightage: 60, kpis: [{ label: 'QREV', weightage: 40 }] },
      { label: 'QLT', weightage: 40, kpis: [{ label: 'DEF', weightage: 100 }] },
    ]);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => /KRA "REV"/.test(e) && /currently 40%/.test(e))).toBe(true);
  });
});

describe('canReissueAssignment', () => {
  it('re-issues a set the employee returned, so the revise loop can close', () => {
    // Without this, a RETURNED set dead-ends: assign skips it and accept
    // refuses it, so the employee can never receive the corrected goals.
    expect(canReissueAssignment('RETURNED')).toBe(true);
  });

  it('overwrites a draft that was never issued', () => {
    expect(canReissueAssignment('DRAFT')).toBe(true);
  });

  it('refuses to rewrite a set already with the employee or committed to', () => {
    expect(canReissueAssignment('PENDING_ACCEPTANCE')).toBe(false);
    expect(canReissueAssignment('ACCEPTED')).toBe(false);
    expect(canReissueAssignment('COMPLETED')).toBe(false);
  });
});
