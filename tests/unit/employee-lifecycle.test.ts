import { describe, it, expect } from 'vitest';
import {
  TRANSITIONS,
  LIFECYCLE_STATES,
  isTransitionAllowed,
  allowedTargets,
  legacyStatusFor,
  deriveLifecycleState,
  creationChain,
  type LifecycleState,
} from '@/lib/employee/lifecycle';

describe('lifecycle — §8.2 transition table', () => {
  it('lists every one of the 22 rules (rule 4 folds into rule 3)', () => {
    const rules = TRANSITIONS.map((t) => t.rule).sort((a, b) => a - b);
    expect(rules).toEqual([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
  });

  it.each([
    [null, 'DRAFT'],
    ['DRAFT', 'CANDIDATE_CONVERTED'],
    ['CANDIDATE_CONVERTED', 'PROBATION'],
    ['PROBATION', 'CONFIRMED'],
    ['PROBATION', 'SEPARATED'],
    ['PROBATION', 'ON_NOTICE'],
    ['PROBATION', 'LONG_LEAVE'],
    ['CONFIRMED', 'ON_NOTICE'],
    ['CONFIRMED', 'SUSPENDED'],
    ['CONFIRMED', 'LONG_LEAVE'],
    ['LONG_LEAVE', 'CONFIRMED'],
    ['LONG_LEAVE', 'PROBATION'],
    ['LONG_LEAVE', 'SEPARATED'],
    ['SUSPENDED', 'CONFIRMED'],
    ['SUSPENDED', 'SEPARATED'],
    ['ON_NOTICE', 'SEPARATED'],
    ['ON_NOTICE', 'CONFIRMED'],
    ['ON_NOTICE', 'SUSPENDED'],
    ['SEPARATED', 'REHIRED'],
    ['REHIRED', 'PROBATION'],
    ['REHIRED', 'CONFIRMED'],
  ] as Array<[LifecycleState | null, LifecycleState]>)('permits %s → %s', (from, to) => {
    expect(isTransitionAllowed(from, to)).toBe(true);
  });

  it.each([
    ['CONFIRMED', 'PROBATION'],
    ['CONFIRMED', 'DRAFT'],
    ['SEPARATED', 'CONFIRMED'],
    ['SEPARATED', 'PROBATION'],
    ['DRAFT', 'PROBATION'],
    ['SUSPENDED', 'ON_NOTICE'],
    ['PROBATION', 'SUSPENDED'],
    ['ON_NOTICE', 'PROBATION'],
    ['REHIRED', 'SEPARATED'],
    [null, 'CONFIRMED'],
  ] as Array<[LifecycleState | null, LifecycleState]>)('rejects %s → %s', (from, to) => {
    expect(isTransitionAllowed(from, to)).toBe(false);
  });

  it('offers only the permitted targets from each state and nothing from a terminal-ish one twice', () => {
    expect(allowedTargets('CONFIRMED').sort()).toEqual(['LONG_LEAVE', 'ON_NOTICE', 'SUSPENDED']);
    expect(allowedTargets('SEPARATED')).toEqual(['REHIRED']);
    expect(allowedTargets('DRAFT')).toEqual(['CANDIDATE_CONVERTED']);
    for (const s of LIFECYCLE_STATES) expect(allowedTargets(s)).not.toContain(s);
  });
});

describe('lifecycle — legacy status mapping', () => {
  it('maps working states to active, LONG_LEAVE to on-leave, SEPARATED to terminated', () => {
    for (const s of ['PROBATION', 'CONFIRMED', 'ON_NOTICE', 'SUSPENDED', 'REHIRED', 'DRAFT', 'CANDIDATE_CONVERTED'] as LifecycleState[]) {
      expect(legacyStatusFor(s)).toBe('active');
    }
    expect(legacyStatusFor('LONG_LEAVE')).toBe('on-leave');
    expect(legacyStatusFor('SEPARATED')).toBe('terminated');
  });
  it('keeps an existing resigned status on separation', () => {
    expect(legacyStatusFor('SEPARATED', 'resigned')).toBe('resigned');
    expect(legacyStatusFor('SEPARATED', 'active')).toBe('terminated');
  });
});

describe('lifecycle — derivation for legacy rows (backfill)', () => {
  it('on-leave → LONG_LEAVE; terminated / resigned → SEPARATED', () => {
    expect(deriveLifecycleState({ status: 'on-leave' })).toBe('LONG_LEAVE');
    expect(deriveLifecycleState({ status: 'terminated' })).toBe('SEPARATED');
    expect(deriveLifecycleState({ status: 'resigned' })).toBe('SEPARATED');
  });
  it('active: confirmed when a confirmation date exists, in probation while an end date is pending, else confirmed', () => {
    expect(deriveLifecycleState({ status: 'active', confirmationDate: new Date() })).toBe('CONFIRMED');
    expect(deriveLifecycleState({ status: 'active', probationEndDate: new Date('2099-01-01') })).toBe('PROBATION');
    expect(deriveLifecycleState({ status: 'active', probationEndDate: new Date('2020-01-01'), confirmationDate: null })).toBe('PROBATION');
    expect(deriveLifecycleState({ status: 'active' })).toBe('CONFIRMED');
  });
});

describe('lifecycle — creation chain (§8.2 rules 1–5)', () => {
  it('a Recruitment handoff stops at DRAFT', () => {
    expect(creationChain({ draftOnly: true })).toEqual(['DRAFT']);
  });
  it('a manual create with probation lands in PROBATION', () => {
    expect(creationChain({ probationMonths: 6 })).toEqual(['DRAFT', 'CANDIDATE_CONVERTED', 'PROBATION']);
  });
  it('a manual create without probation runs on to CONFIRMED (rule 4)', () => {
    expect(creationChain({ probationMonths: 0 })).toEqual(['DRAFT', 'CANDIDATE_CONVERTED', 'PROBATION', 'CONFIRMED']);
    expect(creationChain({ probationMonths: null })).toEqual(['DRAFT', 'CANDIDATE_CONVERTED', 'PROBATION', 'CONFIRMED']);
  });
  it('every chain step is a permitted transition', () => {
    for (const chain of [creationChain({ draftOnly: true }), creationChain({ probationMonths: 3 }), creationChain({ probationMonths: 0 })]) {
      let prev: LifecycleState | null = null;
      for (const step of chain) {
        expect(isTransitionAllowed(prev, step)).toBe(true);
        prev = step;
      }
    }
  });
});
