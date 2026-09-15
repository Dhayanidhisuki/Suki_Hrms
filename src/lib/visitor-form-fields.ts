/**
 * Visitor form field helpers — same pattern as employee-form-fields.
 */

export interface VisitorOption {
  label: string;
  value: string;
}

export interface VisitorOptions {
  visitor_type: VisitorOption[];
  visitor_purpose: VisitorOption[];
  visitor_food_category: VisitorOption[];
  visitor_food_type: VisitorOption[];
  visitor_gadgets: VisitorOption[];
}

export async function fetchVisitorOptions(): Promise<VisitorOptions> {
  const res = await fetch('/api/visitor/options');
  if (!res.ok) return {
    visitor_type: [],
    visitor_purpose: [],
    visitor_food_category: [],
    visitor_food_type: [],
    visitor_gadgets: [],
  };
  return res.json();
}

export const PASS_TYPE_OPTIONS = [
  { label: 'GATE PASS', value: 'GATE_PASS' },
  { label: 'WORK PERMIT', value: 'WORK_PERMIT' },
];

export const STATUS_OPTIONS = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Pending Approval', value: 'PENDING_APPROVAL' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Checked In', value: 'CHECKED_IN' },
  { label: 'Checked Out', value: 'CHECKED_OUT' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Expired', value: 'EXPIRED' },
];

export function formatPassType(passType: string): string {
  return passType === 'GATE_PASS' ? 'GATE PASS' : 'WORK PERMIT';
}

export function formatStatus(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Draft',
    PENDING_APPROVAL: 'Pending Approval',
    APPROVED: 'Approved',
    CHECKED_IN: 'Checked In',
    CHECKED_OUT: 'Checked Out',
    COMPLETED: 'Completed',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
  };
  return map[status] ?? status.replace(/_/g, ' ');
}

export function statusTone(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'DRAFT':
    case 'PENDING_APPROVAL':
      return { bg: 'var(--surface-muted)', fg: 'var(--foreground-muted)' };
    case 'APPROVED':
      return { bg: 'var(--accent-soft)', fg: 'var(--accent)' };
    case 'CHECKED_IN':
      return { bg: 'var(--success-soft)', fg: 'var(--success)' };
    case 'CHECKED_OUT':
      return { bg: 'var(--info-soft)', fg: 'var(--info)' };
    case 'COMPLETED':
      return { bg: 'var(--success-soft)', fg: 'var(--success)' };
    case 'REJECTED':
    case 'CANCELLED':
    case 'EXPIRED':
      return { bg: 'var(--danger-soft)', fg: 'var(--danger)' };
    default:
      return { bg: 'var(--surface-muted)', fg: 'var(--foreground-muted)' };
  }
}
