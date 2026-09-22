export const FNF_CALCULABLE = new Set(['pending', 'reopened', 'calculated', 'on_hold']);
export const FNF_SUBMITTABLE = new Set(['calculated']);
export const FNF_MANAGER_APPROVABLE = new Set(['pending_manager']);
export const FNF_APPROVABLE = new Set(['submitted']);
export const FNF_FINANCE_VERIFIABLE = new Set(['approved']);
export const FNF_REJECTABLE = new Set(['calculated', 'pending_manager', 'submitted', 'approved']);
export const FNF_PAYABLE = new Set(['finance_verified', 'approved']);
export const FNF_HOLDABLE = new Set(['calculated', 'pending_manager', 'submitted']);
export const FNF_COMPLETABLE = new Set(['paid']);
export const FNF_REOPENABLE = new Set([
  'approved',
  'finance_verified',
  'rejected',
  'calculated',
  'pending_manager',
  'submitted',
  'on_hold',
]);
export const FNF_CANCELABLE = new Set(['pending', 'reopened', 'calculated', 'on_hold']);

export const FNF_STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'accent'> = {
  pending: 'neutral',
  reopened: 'warning',
  calculated: 'info',
  pending_manager: 'warning',
  submitted: 'accent',
  approved: 'success',
  finance_verified: 'success',
  paid: 'success',
  completed: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
  on_hold: 'warning',
};

export function submitStatus(approvalStages: string | null | undefined): 'pending_manager' | 'submitted' {
  return approvalStages === 'MANAGER_HR_FINANCE' ? 'pending_manager' : 'submitted';
}

export function statusAfterHrApprove(approvalStages: string | null | undefined): 'approved' | 'finance_verified' {
  return approvalStages === 'HR' ? 'finance_verified' : 'approved';
}

export function payableStatuses(approvalStages: string | null | undefined): Set<string> {
  if (approvalStages === 'HR') return new Set(['approved', 'finance_verified']);
  return new Set(['finance_verified']);
}

export function assertStatus(actual: string, allowed: Set<string>, action: string): string | null {
  if (allowed.has(actual)) return null;
  return `Cannot ${action} a settlement in status ${actual}`;
}

export function queueStatuses(queue: string): string[] | null {
  if (queue === 'manager') return ['pending_manager'];
  if (queue === 'hr') return ['submitted'];
  if (queue === 'finance') return ['approved'];
  if (queue === 'payable') return ['finance_verified', 'approved'];
  return null;
}

/**
 * What the employee may see of their own settlement in ESS.
 *
 * The anchor is the notification catalogue in lib/fnf/notify.ts: the events
 * addressed to SUBJECT_EMPLOYEE are exactly the points at which the system has
 * already decided to tell them something. ESS should corroborate those
 * messages, not run ahead of them.
 *
 * 'full'        — HR has approved, so the figures are committed and the
 *                 statement and PDF are the employee's to keep.
 * 'status-only' — the employee was notified (hold, rejection, reopen) and must
 *                 be able to see why their money is delayed, but the amounts
 *                 are mid-revision and are not a promise. Showing a provisional
 *                 net here is how a draft number becomes a dispute.
 * 'hidden'      — pending/calculated/pending_manager/submitted are payroll's
 *                 internal working state, and a cancelled settlement is
 *                 notified to HR only.
 */
export const ESS_VISIBLE_WITH_AMOUNTS = new Set(['approved', 'finance_verified', 'paid', 'completed']);
export const ESS_VISIBLE_STATUS_ONLY = new Set(['on_hold', 'rejected', 'reopened']);

export type EssVisibility = 'full' | 'status-only' | 'hidden';

export function essVisibility(status: string): EssVisibility {
  if (ESS_VISIBLE_WITH_AMOUNTS.has(status)) return 'full';
  if (ESS_VISIBLE_STATUS_ONLY.has(status)) return 'status-only';
  return 'hidden';
}
