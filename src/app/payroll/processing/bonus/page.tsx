/**
 * Bonus Management — AC Year batch calculation against a configurable
 * BonusRate, single-approver workflow (Calculated/Approved/Rejected/Hold),
 * then "Apply to Payroll" pushes the approved amount into a target
 * PayrollRun as an ad-hoc earning line (src/lib/bonusApply.ts). No revision
 * cycles, no allocable-surplus variable bonus, no bulk upload in Phase 1.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, type Column } from '@/components/ui';

interface BonusRow {
  id: number;
  employeeId: number;
  acYear: number;
  employee: {
    employeeCode: string;
    firstName: string;
    lastName: string;
    jobInfos: { department: { name: string } | null; designation: { name: string } | null }[];
  };
  doj: string;
  yearsOfService: string;
  currentGross: string;
  currentBasic: string;
  bonusPercent: string | null;
  bonusAmount: string | null;
  eligibilityStatus: string;
  eligibilityReason: string | null;
  calculationType: string;
  status: string;
  holdReason: string | null;
  rejectReason: string | null;
  remarks: string | null;
}
interface UnitOption {
  id: number;
  name: string;
}
interface RunOption {
  id: number;
  year: number;
  month: number;
  status: string;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: '#f3f4f6', fg: '#4b5563' },
  NOT_ELIGIBLE: { bg: '#f3f4f6', fg: '#6b7280' },
  CALCULATED: { bg: '#fef9c3', fg: '#854d0e' },
  APPROVED: { bg: '#dbeafe', fg: '#1e40af' },
  REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
  HOLD: { bg: '#ffedd5', fg: '#9a3412' },
  PROCESSED: { bg: '#dcfce7', fg: '#166534' },
};

const now = new Date();
const defaultAcYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

function ReasonModal({
  isOpen,
  title,
  label,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  title: string;
  label: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl shadow-2xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 space-y-3">
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h2>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{label} <span className="text-red-500">*</span></label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
              Cancel
            </button>
            <button
              disabled={submitting}
              onClick={async () => {
                if (!reason.trim()) {
                  setError(`${label} is required`);
                  return;
                }
                setSubmitting(true);
                try {
                  await onSubmit(reason.trim());
                  onClose();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed');
                } finally {
                  setSubmitting(false);
                }
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#991b1b' }}
            >
              {submitting ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PercentModal({
  isOpen,
  title,
  count,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  title: string;
  count: number;
  onClose: () => void;
  onSubmit: (percent: number) => Promise<void>;
}) {
  const [percent, setPercent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPercent('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl shadow-2xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 space-y-3">
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h2>
          {count > 1 && <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Applies to {count} selected employees.</p>}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Bonus % <span className="text-red-500">*</span></label>
            <input
              type="number"
              step="0.01"
              min={8.33}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            />
            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Cannot be below the statutory minimum, 8.33%.</span>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
              Cancel
            </button>
            <button
              disabled={submitting}
              onClick={async () => {
                const value = Number(percent);
                if (!percent || Number.isNaN(value) || value < 8.33) {
                  setError('Enter a value of at least 8.33');
                  return;
                }
                setSubmitting(true);
                setError(null);
                try {
                  await onSubmit(value);
                  onClose();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed');
                } finally {
                  setSubmitting(false);
                }
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {submitting ? 'Saving...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApplyModal({
  row,
  onClose,
  onApply,
}: {
  row: BonusRow | null;
  onClose: () => void;
  onApply: (payrollRunId: number) => Promise<void>;
}) {
  const [runs, setRuns] = useState<RunOption[]>([]);
  const [runId, setRunId] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!row) return;
    setRunId('');
    setError(null);
    fetch('/api/payroll/runs')
      .then((r) => r.json())
      .then((json: { data: RunOption[] }) => setRuns((json.data ?? []).filter((r) => r.status === 'DRAFT' || r.status === 'CALCULATED')));
  }, [row]);

  if (!row) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl shadow-2xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 space-y-3">
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Apply to Payroll</h2>
          {runs.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No editable payroll run exists yet — create one on Salary Processing first.</p>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Target Payroll Run <span className="text-red-500">*</span></label>
              <select
                value={runId}
                onChange={(e) => setRunId(e.target.value === '' ? '' : Number(e.target.value))}
                className="rounded-lg border px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
              >
                <option value="">— Select —</option>
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.year}-{String(r.month).padStart(2, '0')} ({r.status})
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
              Cancel
            </button>
            <button
              disabled={submitting || !runId}
              onClick={async () => {
                if (!runId) return;
                setSubmitting(true);
                setError(null);
                try {
                  await onApply(runId);
                  onClose();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed');
                } finally {
                  setSubmitting(false);
                }
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {submitting ? 'Applying...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BonusPage() {
  const [acYear, setAcYear] = useState(defaultAcYear);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState<BonusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ row: BonusRow; action: 'approve' | 'release-hold' } | null>(null);
  const [reasonModal, setReasonModal] = useState<{ row: BonusRow; action: 'reject' | 'hold' } | null>(null);
  const [applyRow, setApplyRow] = useState<BonusRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [percentTargetIds, setPercentTargetIds] = useState<number[] | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ acYear: String(acYear) });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/bonus/records?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: { data: BonusRow[] } = await res.json();
      setRecords(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [acYear, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const callAction = async (id: number, path: string, body?: Record<string, unknown>) => {
    const res = await fetch(`/api/bonus/records/${id}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Action failed');
    }
    await fetchData();
  };

  const calculate = async () => {
    setCalculating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/bonus/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acYear }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Calculate failed');
      setSuccessMessage(json.message ?? 'Done');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCalculating(false);
    }
  };

  const filtered = records.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.employee.employeeCode.toLowerCase().includes(q) || `${r.employee.firstName} ${r.employee.lastName}`.toLowerCase().includes(q);
  });

  const editPercent = async (ids: number[], bonusPercent: number) => {
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/bonus/records/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bonusPercent }),
        })
      )
    );
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      const err = await failed[0].json();
      throw new Error(failed.length === ids.length ? (err.error ?? 'Failed') : `${failed.length} of ${ids.length} failed: ${err.error ?? 'Failed'}`);
    }
    setSelectedIds(new Set());
    await fetchData();
  };

  const selectableIds = filtered.filter((r) => r.status === 'CALCULATED').map((r) => r.id);
  const allSelectableChecked = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  const columns: Column<BonusRow>[] = [
    {
      key: 'select',
      label: '',
      render: (r) =>
        r.status === 'CALCULATED' ? (
          <input
            type="checkbox"
            checked={selectedIds.has(r.id)}
            onChange={(e) =>
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (e.target.checked) next.add(r.id);
                else next.delete(r.id);
                return next;
              })
            }
          />
        ) : null,
    },
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'doj', label: 'DOJ', render: (r) => new Date(r.doj).toLocaleDateString() },
    { key: 'department', label: 'Department', render: (r) => r.employee.jobInfos[0]?.department?.name ?? '—' },
    { key: 'designation', label: 'Designation', render: (r) => r.employee.jobInfos[0]?.designation?.name ?? '—' },
    { key: 'yearsOfService', label: 'Yrs of Service' },
    { key: 'currentGross', label: 'Current Gross' },
    { key: 'currentBasic', label: 'Basic' },
    { key: 'calculationType', label: 'Type', render: (r) => (r.calculationType === 'ACTUAL_NET_PAY' ? 'Actual Net Pay' : 'Basic Projection') },
    { key: 'bonusPercent', label: 'Bonus %', render: (r) => r.bonusPercent ?? '—' },
    { key: 'bonusAmount', label: 'Bonus Amount', className: 'font-medium', render: (r) => r.bonusAmount ?? '—' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <span
          title={
            r.eligibilityReason ?? (r.status === 'HOLD' ? (r.holdReason ?? undefined) : r.status === 'REJECTED' ? (r.rejectReason ?? undefined) : undefined)
          }
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: STATUS_COLORS[r.status]?.bg ?? '#f3f4f6', color: STATUS_COLORS[r.status]?.fg ?? '#4b5563' }}
        >
          {r.status}
        </span>
      ),
    },
    { key: 'remarks', label: 'Remark', render: (r) => r.remarks ?? '—' },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex gap-2 justify-end">
          {r.status === 'CALCULATED' && (
            <>
              <button onClick={() => setPercentTargetIds([r.id])} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                Edit %
              </button>
              <button onClick={() => setConfirm({ row: r, action: 'approve' })} className="text-xs font-medium hover:underline" style={{ color: '#166534' }}>
                Approve
              </button>
              <button onClick={() => setReasonModal({ row: r, action: 'reject' })} className="text-xs font-medium hover:underline text-red-500">
                Reject
              </button>
              <button onClick={() => setReasonModal({ row: r, action: 'hold' })} className="text-xs font-medium hover:underline" style={{ color: '#9a3412' }}>
                Hold
              </button>
            </>
          )}
          {r.status === 'HOLD' && (
            <button onClick={() => setConfirm({ row: r, action: 'release-hold' })} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
              Release Hold
            </button>
          )}
          {r.status === 'APPROVED' && (
            <button onClick={() => setApplyRow(r)} className="text-xs font-medium hover:underline" style={{ color: '#166534' }}>
              Apply to Payroll
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Bonus</h1>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={acYear}
            onChange={(e) => setAcYear(Number(e.target.value))}
            className="w-24 rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="NOT_ELIGIBLE">Not Eligible</option>
            <option value="CALCULATED">Calculated</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="HOLD">Hold</option>
            <option value="PROCESSED">Processed</option>
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee..."
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          />
          <button
            disabled={calculating}
            onClick={calculate}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {calculating ? 'Calculating...' : 'Calculate'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}
      {successMessage && (
        <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-xs font-medium hover:underline">Dismiss</button>
        </div>
      )}

      {selectableIds.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground-muted)' }}>
            <input
              type="checkbox"
              checked={allSelectableChecked}
              onChange={(e) => setSelectedIds(e.target.checked ? new Set(selectableIds) : new Set())}
            />
            Select all calculated
          </label>
          <button
            disabled={selectedIds.size === 0}
            onClick={() => setPercentTargetIds(Array.from(selectedIds))}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Set Bonus % ({selectedIds.size} selected)
          </button>
        </div>
      )}

      <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No bonus records — click Calculate." />

      <ConfirmDialog
        isOpen={!!confirm}
        title={confirm?.action === 'approve' ? 'Approve Bonus' : 'Release Hold'}
        message={
          confirm?.action === 'approve'
            ? 'This bonus record will be marked approved and ready to apply to payroll.'
            : 'This bonus record will return to Calculated status.'
        }
        confirmLabel={confirm?.action === 'approve' ? 'Approve' : 'Release'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          callAction(confirm.row.id, confirm.action).catch((e) => setError(e.message));
          setConfirm(null);
        }}
      />

      <ReasonModal
        isOpen={!!reasonModal}
        title={reasonModal?.action === 'reject' ? 'Reject Bonus' : 'Hold Bonus'}
        label={reasonModal?.action === 'reject' ? 'Reject Reason' : 'Hold Reason'}
        onClose={() => setReasonModal(null)}
        onSubmit={async (reason) => {
          if (!reasonModal) return;
          const key = reasonModal.action === 'reject' ? 'rejectReason' : 'holdReason';
          await callAction(reasonModal.row.id, reasonModal.action, { [key]: reason });
        }}
      />

      <PercentModal
        isOpen={!!percentTargetIds}
        title={percentTargetIds && percentTargetIds.length > 1 ? 'Set Bonus %' : 'Edit Bonus %'}
        count={percentTargetIds?.length ?? 0}
        onClose={() => setPercentTargetIds(null)}
        onSubmit={async (percent) => {
          if (!percentTargetIds) return;
          await editPercent(percentTargetIds, percent);
        }}
      />

      <ApplyModal
        row={applyRow}
        onClose={() => setApplyRow(null)}
        onApply={async (payrollRunId) => {
          if (!applyRow) return;
          await callAction(applyRow.id, 'apply', { payrollRunId });
        }}
      />
    </div>
  );
}
