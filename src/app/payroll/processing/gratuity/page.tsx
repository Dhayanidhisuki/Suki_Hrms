/**
 * Gratuity Management — per-employee (not a whole-company batch like Bonus)
 * calculation triggered off an employee's own ExitInterview, then a
 * single-approver workflow (Calculated/Approved/Rejected/Hold) ending in a
 * direct settlement (Mark Paid) rather than an ad-hoc Payroll line — gratuity
 * is a terminal payment, not an ongoing payroll component.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, SearchableSelect, type Column } from '@/components/ui';

interface GratuityRow {
  id: number;
  employeeId: number;
  employee: {
    employeeCode: string;
    firstName: string;
    lastName: string;
    jobInfos: { department: { name: string } | null; designation: { name: string } | null }[];
  };
  doj: string;
  separationDate: string;
  qualifyingServiceYears: string;
  eligibilityStatus: string;
  eligibilityReason: string | null;
  eligibleSalary: string | null;
  grossGratuity: string | null;
  payableGratuity: string | null;
  status: string;
  holdReason: string | null;
  rejectReason: string | null;
  remarks: string | null;
  paymentDate: string | null;
  paymentReference: string | null;
}

interface SeparationOption {
  id: number;
  employeeId: number;
  employee: { employeeCode: string; firstName: string; lastName: string };
  gratuityRecord: { id: number; status: string } | null;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  NOT_ELIGIBLE: { bg: '#f3f4f6', fg: '#6b7280' },
  CALCULATED: { bg: '#fef9c3', fg: '#854d0e' },
  APPROVED: { bg: '#dbeafe', fg: '#1e40af' },
  REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
  HOLD: { bg: '#ffedd5', fg: '#9a3412' },
  PAID: { bg: '#dcfce7', fg: '#166534' },
};

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

function MarkPaidModal({
  row,
  onClose,
  onSubmit,
}: {
  row: GratuityRow | null;
  onClose: () => void;
  onSubmit: (paymentDate: string, paymentReference: string) => Promise<void>;
}) {
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (row) {
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentReference('');
      setError(null);
    }
  }, [row]);

  if (!row) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl shadow-2xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 space-y-3">
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Mark Paid</h2>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Payable Gratuity: <span className="font-medium" style={{ color: 'var(--foreground)' }}>₹{row.payableGratuity}</span>
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Payment Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Payment Reference <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="e.g. UTR / cheque number"
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
                if (!paymentDate || !paymentReference.trim()) {
                  setError('Both fields are required');
                  return;
                }
                setSubmitting(true);
                setError(null);
                try {
                  await onSubmit(paymentDate, paymentReference.trim());
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
              {submitting ? 'Saving...' : 'Mark Paid'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GratuityPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [records, setRecords] = useState<GratuityRow[]>([]);
  const [separations, setSeparations] = useState<SeparationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [calcEmployeeId, setCalcEmployeeId] = useState<number | ''>('');
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ row: GratuityRow; action: 'approve' | 'release-hold' } | null>(null);
  const [reasonModal, setReasonModal] = useState<{ row: GratuityRow; action: 'reject' | 'hold' } | null>(null);
  const [payRow, setPayRow] = useState<GratuityRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const [recRes, sepRes] = await Promise.all([
        fetch(`/api/gratuity/records?${params}`),
        fetch('/api/employees/separations'),
      ]);
      if (!recRes.ok || !sepRes.ok) throw new Error('Failed to fetch');
      const recJson: { data: GratuityRow[] } = await recRes.json();
      const sepJson: { data: SeparationOption[] } = await sepRes.json();
      setRecords(recJson.data);
      setSeparations(sepJson.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const callAction = async (id: number, path: string, body?: Record<string, unknown>) => {
    const res = await fetch(`/api/gratuity/records/${id}/${path}`, {
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
    if (!calcEmployeeId) return;
    setCalculating(true);
    setError(null);
    try {
      const res = await fetch('/api/gratuity/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: calcEmployeeId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Calculate failed');
      setCalcEmployeeId('');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCalculating(false);
    }
  };

  const candidateEmployees = separations.filter((s) => !s.gratuityRecord);

  const columns: Column<GratuityRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'department', label: 'Department', render: (r) => r.employee.jobInfos[0]?.department?.name ?? '—' },
    { key: 'doj', label: 'DOJ', render: (r) => new Date(r.doj).toLocaleDateString() },
    { key: 'separationDate', label: 'Separation Date', render: (r) => new Date(r.separationDate).toLocaleDateString() },
    { key: 'qualifyingServiceYears', label: 'Qualifying Service (Yrs)' },
    { key: 'eligibleSalary', label: 'Eligible Salary', render: (r) => r.eligibleSalary ?? '—' },
    { key: 'grossGratuity', label: 'Gross Gratuity', render: (r) => r.grossGratuity ?? '—' },
    { key: 'payableGratuity', label: 'Payable Gratuity', className: 'font-medium', render: (r) => r.payableGratuity ?? '—' },
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
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex gap-2 justify-end">
          {(r.status === 'CALCULATED' || r.status === 'NOT_ELIGIBLE') && (
            <button onClick={() => callAction(r.id, 'recalculate').catch((e) => setError(e.message))} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
              Recalculate
            </button>
          )}
          {r.status === 'CALCULATED' && (
            <>
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
            <button onClick={() => setPayRow(r)} className="text-xs font-medium hover:underline" style={{ color: '#166534' }}>
              Mark Paid
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Gratuity</h1>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          >
            <option value="">All Statuses</option>
            <option value="NOT_ELIGIBLE">Not Eligible</option>
            <option value="CALCULATED">Calculated</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="HOLD">Hold</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Calculate Gratuity</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-64 flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Separated Employee</label>
            <SearchableSelect
              value={calcEmployeeId}
              options={candidateEmployees.map((s) => ({ label: `${s.employee.employeeCode} — ${s.employee.firstName} ${s.employee.lastName}`, value: s.employeeId }))}
              onChange={(v) => setCalcEmployeeId(v === '' ? '' : Number(v))}
            />
          </div>
          <button
            disabled={!calcEmployeeId || calculating}
            onClick={calculate}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {calculating ? 'Calculating...' : 'Calculate'}
          </button>
        </div>
        {candidateEmployees.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>No separated employees are waiting on a gratuity calculation.</p>
        )}
      </div>

      <DataTable columns={columns} data={records} loading={loading} emptyMessage="No gratuity records yet." />

      <ConfirmDialog
        isOpen={!!confirm}
        title={confirm?.action === 'approve' ? 'Approve Gratuity' : 'Release Hold'}
        message={
          confirm?.action === 'approve'
            ? 'This gratuity record will be marked approved and ready to mark paid.'
            : 'This gratuity record will return to Calculated status.'
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
        title={reasonModal?.action === 'reject' ? 'Reject Gratuity' : 'Hold Gratuity'}
        label={reasonModal?.action === 'reject' ? 'Reject Reason' : 'Hold Reason'}
        onClose={() => setReasonModal(null)}
        onSubmit={async (reason) => {
          if (!reasonModal) return;
          const key = reasonModal.action === 'reject' ? 'rejectReason' : 'holdReason';
          await callAction(reasonModal.row.id, reasonModal.action, { [key]: reason });
        }}
      />

      <MarkPaidModal
        row={payRow}
        onClose={() => setPayRow(null)}
        onSubmit={async (paymentDate, paymentReference) => {
          if (!payRow) return;
          await callAction(payRow.id, 'mark-paid', { paymentDate, paymentReference });
        }}
      />
    </div>
  );
}
