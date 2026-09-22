import { describe, it, expect } from 'vitest';
import {
  assertStatus,
  FNF_CANCELABLE,
  payableStatuses,
  queueStatuses,
  statusAfterHrApprove,
  submitStatus,
} from '@/lib/fnf/workflow';

describe('F&F workflow', () => {
  it('routes submit to manager only when chain includes manager', () => {
    expect(submitStatus('HR')).toBe('submitted');
    expect(submitStatus('HR_FINANCE')).toBe('submitted');
    expect(submitStatus('MANAGER_HR_FINANCE')).toBe('pending_manager');
  });

  it('skips finance verify after HR approve when chain is HR-only', () => {
    expect(statusAfterHrApprove('HR')).toBe('finance_verified');
    expect(statusAfterHrApprove('HR_FINANCE')).toBe('approved');
  });

  it('allows mark-paid from approved only for HR-only chain', () => {
    expect(payableStatuses('HR').has('approved')).toBe(true);
    expect(payableStatuses('HR_FINANCE').has('approved')).toBe(false);
    expect(payableStatuses('HR_FINANCE').has('finance_verified')).toBe(true);
  });

  it('blocks cancel after submit', () => {
    expect(assertStatus('calculated', FNF_CANCELABLE, 'cancel')).toBeNull();
    expect(assertStatus('submitted', FNF_CANCELABLE, 'cancel')).toMatch(/Cannot cancel/);
  });

  it('maps approval queues', () => {
    expect(queueStatuses('hr')).toEqual(['submitted']);
    expect(queueStatuses('finance')).toEqual(['approved']);
    expect(queueStatuses('manager')).toEqual(['pending_manager']);
  });
});
