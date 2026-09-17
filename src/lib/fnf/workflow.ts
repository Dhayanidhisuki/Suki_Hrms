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
