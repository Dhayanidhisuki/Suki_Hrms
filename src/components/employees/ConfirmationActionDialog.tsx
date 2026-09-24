/**
 * Styled Approve / Reject dialog for the Pending Confirmations queue.
 *
 * Both actions share one layout — tinted header, employee card, a
 * "Confirmation Details" summary, a coloured notice, optional reason
 * (reject only) and a free-text remark — with the tone (green/red) and the
 * copy swapped per `mode`.
 */

'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui';
import EmployeeAvatar from './EmployeeAvatar';
import { formatDate } from '@/lib/format-date';

export interface ConfirmationTarget {
  id: number;
  employeeCode: string;
  oldEmployeeCode: string | null;
  firstName: string;
  lastName: string;
  department: { name: string } | null;
  designation: { name: string } | null;
  profilePhotoPath?: string | null;
  joinDate: string;
  probationEndDate: string;
}

export const REJECT_REASONS = [
  'Performance not satisfactory',
  'Attendance / punctuality issues',
  'Conduct / disciplinary concerns',
  'Role no longer required',
  'Employee opted not to continue',
  'Other',
];

interface Props {
  mode: 'approve' | 'reject';
  target: ConfirmationTarget | null;
  daysOverdue: number;
  onClose: () => void;
  /** Resolves on success; throw to surface an error inside the dialog. */
  onSubmit: (payload: { remarks: string; reason?: string }) => Promise<void>;
}

const TONE = {
  approve: {
    fg: 'var(--success)',
    soft: 'var(--success-soft)',
    title: 'Confirm Employee',
    question: 'Are you sure you want to confirm this employee?',
    note: (
      <>
        Once approved, the employee&apos;s probation status will be updated to <strong>Confirmed.</strong>
      </>
    ),
    noticeFg: 'var(--info)',
    noticeSoft: 'var(--info-soft)',
    submit: 'Confirm & Approve',
    busy: 'Approving...',
  },
  reject: {
    fg: 'var(--danger)',
    soft: 'var(--danger-soft)',
    title: 'Reject Employee Confirmation',
    question: 'Are you sure you want to Reject this employee?',
    note: (
      <>
        This action will mark the employee&apos;s confirmation as <strong>Rejected.</strong>
      </>
    ),
    noticeFg: 'var(--danger)',
    noticeSoft: 'var(--danger-soft)',
    submit: 'Reject Confirmation',
    busy: 'Rejecting...',
  },
} as const;

const Icon = {
  Check: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  X: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  ),
  File: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  ),
  Calendar: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  ),
  Alert: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  ),
  Info: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Chat: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M8 12h.01M12 12h.01M16 12h.01" />
    </svg>
  ),
  ChevronDown: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
};

export default function ConfirmationActionDialog({ mode, target, daysOverdue, onClose, onSubmit }: Props) {
  const t = TONE[mode];
  const toast = useToast();
  const [remarks, setRemarks] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Form state resets per target because the parent keys this component on
  // the target's id (see the confirmation page).

  if (!target) return null;

  const handleSubmit = async () => {
    if (mode === 'reject' && !reason) {
      toast.warning('Please select a reason for rejection.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ remarks: remarks.trim(), reason: reason || undefined });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    borderColor: 'var(--border)',
    backgroundColor: 'var(--surface)',
    color: 'var(--foreground)',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-dialog-title"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ backgroundColor: t.soft }}>
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: t.fg }}
            >
              {mode === 'approve' ? <Icon.Check /> : <Icon.X />}
            </span>
            <h2 id="confirmation-dialog-title" className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              {t.title}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 hover:opacity-70" style={{ color: 'var(--foreground)' }}>
            <Icon.X />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Employee card */}
          <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
            <EmployeeAvatar firstName={target.firstName} lastName={target.lastName} photoPath={target.profilePhotoPath} size={56} />
            <div className="min-w-0">
              <div className="font-semibold" style={{ color: 'var(--foreground)' }}>
                {target.firstName} {target.lastName}
              </div>
              <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                {target.oldEmployeeCode ?? '—'}
                {target.department?.name ? ` · ${target.department.name}` : ''}
              </div>
              {target.designation?.name && (
                <span
                  className="mt-1.5 inline-block rounded-md px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: 'var(--info-soft)', color: 'var(--info)' }}
                >
                  {target.designation.name}
                </span>
              )}
            </div>
          </div>

          {/* Confirmation details */}
          <div className="rounded-xl p-3.5 text-sm" style={{ backgroundColor: 'var(--surface-muted)' }}>
            <div className="mb-2 flex items-center gap-1.5 font-medium" style={{ color: 'var(--foreground)' }}>
              <Icon.File />
              Confirmation Details
            </div>
            <dl className="space-y-1.5">
              <DetailRow label="Date of Joining" icon={<Icon.Calendar />} value={formatDate(target.joinDate)} />
              <DetailRow label="Probation End Date" icon={<Icon.Calendar />} value={formatDate(target.probationEndDate)} />
              <DetailRow
                label="Days Overdue"
                icon={<Icon.Alert />}
                value={daysOverdue > 0 ? `${daysOverdue} Days` : 'Due today'}
                valueColor={daysOverdue > 0 ? 'var(--danger)' : 'var(--foreground)'}
                bold
              />
            </dl>
          </div>

          {/* Notice */}
          <div className="flex gap-2.5 rounded-xl p-3.5" style={{ backgroundColor: t.noticeSoft }}>
            <span className="mt-0.5 flex-shrink-0" style={{ color: t.noticeFg }}>
              <Icon.Info />
            </span>
            <div>
              <div className="text-sm font-semibold" style={{ color: t.noticeFg }}>
                {t.question}
              </div>
              <div className="mt-0.5 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                {t.note}
              </div>
            </div>
          </div>

          {/* Reason (reject only) */}
          {mode === 'reject' && (
            <div>
              <label className="mb-1.5 block text-sm" style={{ color: 'var(--foreground)' }}>
                Reason for Rejection
              </label>
              <div className="relative">
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full select-bare appearance-none rounded-lg border py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-2"
                  style={{ ...inputStyle, color: reason ? 'var(--foreground)' : 'var(--foreground-muted)' }}
                >
                  <option value="">Select a reason</option>
                  {REJECT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--foreground-muted)' }}>
                  <Icon.ChevronDown />
                </span>
              </div>
            </div>
          )}

          {/* Remark */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm" style={{ color: 'var(--foreground)' }}>
              <Icon.Chat />
              Add a remark (optional)
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Enter your remark here..."
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={inputStyle}
            />
          </div>

          {/* Footer */}
          <div className="flex justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border px-5 py-2 text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
              style={{ borderColor: t.fg, color: t.fg, backgroundColor: 'var(--surface)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: t.fg }}
            >
              {submitting ? t.busy : t.submit}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  icon,
  value,
  valueColor,
  bold,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  valueColor?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
        {label}
      </dt>
      <dd
        className={`inline-flex items-center gap-1.5 text-xs ${bold ? 'font-semibold' : ''}`}
        style={{ color: valueColor ?? 'var(--foreground)' }}
      >
        <span style={{ color: valueColor ?? 'var(--foreground-muted)' }}>{icon}</span>
        {value}
      </dd>
    </div>
  );
}
