import { describe, it, expect } from 'vitest';
import { FNF_CHAIN_STEPS, segregationConflict, type ChainActors } from '@/lib/fnf/segregation';

const ALICE = 10;
const BOB = 20;

describe('F&F segregation of duties', () => {
  it('blocks the submitter from approving their own settlement', () => {
    const s: ChainActors = { submittedByUserId: ALICE };
    expect(segregationConflict(s, ALICE, 'approve', true)).toMatch(/segregation of duties/i);
  });

  it('names both steps so the message is actionable', () => {
    const s: ChainActors = { approvedByUserId: ALICE };
    const msg = segregationConflict(s, ALICE, 'finance-verify', true);
    expect(msg).toContain('HR-approved');
    expect(msg).toContain('finance-verified');
  });

  it('lets a different user take the next step', () => {
    const s: ChainActors = { submittedByUserId: ALICE, approvedByUserId: BOB };
    expect(segregationConflict(s, 10_000, 'finance-verify', true)).toBeNull();
  });

  it('blocks the approver from also marking it paid', () => {
    const s: ChainActors = { approvedByUserId: ALICE };
    expect(segregationConflict(s, ALICE, 'mark-paid', true)).not.toBeNull();
  });

  it('blocks the finance verifier from also marking it paid', () => {
    const s: ChainActors = { financeVerifiedByUserId: ALICE };
    expect(segregationConflict(s, ALICE, 'mark-paid', true)).not.toBeNull();
  });

  it('allows repeating the SAME step — that is a retry, not a duties failure', () => {
    const s: ChainActors = { approvedByUserId: ALICE };
    expect(segregationConflict(s, ALICE, 'approve', true)).toBeNull();
  });

  it('is inert when the company has turned it off', () => {
    const s: ChainActors = { submittedByUserId: ALICE, approvedByUserId: ALICE };
    for (const step of FNF_CHAIN_STEPS) {
      expect(segregationConflict(s, ALICE, step, false)).toBeNull();
    }
  });

  it('does not block on an unstamped chain', () => {
    for (const step of FNF_CHAIN_STEPS) {
      expect(segregationConflict({}, ALICE, step, true)).toBeNull();
    }
  });

  it('ignores a null actor on an earlier step rather than matching it', () => {
    // A settlement whose steps predate the actor columns has nulls. Treating
    // null == null as a match would deadlock every legacy settlement.
    const s: ChainActors = { submittedByUserId: null, approvedByUserId: null };
    expect(segregationConflict(s, ALICE, 'finance-verify', true)).toBeNull();
    expect(segregationConflict(s, null, 'finance-verify', true)).toBeNull();
  });

  it('catches a conflict against any earlier step, not just the immediately preceding one', () => {
    const s: ChainActors = { submittedByUserId: ALICE, approvedByUserId: BOB };
    expect(segregationConflict(s, ALICE, 'mark-paid', true)).not.toBeNull();
  });
});
