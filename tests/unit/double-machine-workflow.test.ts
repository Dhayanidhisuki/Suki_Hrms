/**
 * Status transitions for Double Machine / Other Incentives.
 *
 * Status used to be a free field: the Excel importer stamped `complete` on
 * every imported row and a POST omitting status defaulted to `complete` too.
 * Now that payrollCalculation pays `complete` rows, these rules are what stand
 * between "HR typed a number" and "the company paid it".
 */

import { describe, it, expect } from 'vitest';
import { planTransition, CAN_APPROVE, CAN_HOLD, CAN_RETURN } from '@/lib/payroll/doubleMachineWorkflow';

describe('planTransition', () => {
  it('approves from draft, process or hold', () => {
    for (const from of ['draft', 'process', 'hold']) {
      expect(planTransition('approve', from)).toEqual({ to: 'complete', activity: 'double_machine_approved' });
    }
  });

  it('refuses to approve something already complete', () => {
    const r = planTransition('approve', 'complete');
    expect(r).toHaveProperty('error');
    expect((r as { error: string }).error).toContain('Already complete');
  });

  it('holds from draft, process or complete — including pulling back an approved row', () => {
    for (const from of ['draft', 'process', 'complete']) {
      expect(planTransition('hold', from)).toEqual({ to: 'hold', activity: 'double_machine_held' });
    }
  });

  it('returns only an approved or held row, sending it back to process', () => {
    expect(planTransition('return', 'complete')).toEqual({ to: 'process', activity: 'double_machine_returned' });
    expect(planTransition('return', 'hold')).toEqual({ to: 'process', activity: 'double_machine_returned' });
    expect(planTransition('return', 'draft')).toHaveProperty('error');
  });

  it('names both the current status and what would have been legal', () => {
    const r = planTransition('return', 'draft') as { error: string };
    expect(r.error).toContain('"draft"');
    expect(r.error).toContain('complete');
    expect(r.error).toContain('hold');
  });

  it('rejects an unknown verb rather than silently doing nothing', () => {
    expect(planTransition('delete' as never, 'draft')).toHaveProperty('error');
  });

  it('never lets a verb land on a status outside the four the model allows', () => {
    const legal = new Set(['draft', 'process', 'hold', 'complete']);
    for (const verb of ['approve', 'hold', 'return'] as const) {
      for (const from of legal) {
        const r = planTransition(verb, from);
        if (!('error' in r)) expect(legal.has(r.to)).toBe(true);
      }
    }
  });

  it('exposes source sets that do not include the verb’s own destination', () => {
    expect(CAN_APPROVE.has('complete')).toBe(false);
    expect(CAN_HOLD.has('hold')).toBe(false);
    expect(CAN_RETURN.has('process')).toBe(false);
  });
});
