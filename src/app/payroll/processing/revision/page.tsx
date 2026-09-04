/**
 * Salary Revision — employee-wise revision requests with a single-approver
 * workflow (Draft/Submitted/Approved/Rejected/Hold/Cancelled). Approving a
 * request versions the employee's salary (src/lib/salaryRevisioning.ts) and,
 * if retroactive, generates an arrear (visible on the Arrears page, badged
 * here). No revision cycles / bulk upload / multi-level approval in Phase 1.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, SearchableSelect, type Column } from '@/components/ui';

interface EmployeeOption {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
}
interface ComponentOption {
  id: number;
  code: string;
  name: string;
  type: string;
}
interface CurrentSalaryComponent {
  salaryComponentId: number;
  amount: string;
  salaryComponent: { name: string; code: string; type: string };
}
interface CurrentSalary {
  grossSalary: string;
  components: CurrentSalaryComponent[];
}
interface RevisionRow {
  id: number;
  employeeId: number;
  employee: { employeeCode: string; firstName: string; lastName: string };
  revisionType: string;
  revisionMethod: string;
  currentGross: string;
  incrementPercent: string | null;
  incrementAmount: string | null;
  revisedGross: string;
  effectiveFrom: string;
  status: string;
  holdReason: string | null;
  rejectReason: string | null;
  arrear: { id: number; status: string; netArrearTotal: string } | null;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: '#f3f4f6', fg: '#4b5563' },
  SUBMITTED: { bg: '#fef9c3', fg: '#854d0e' },
  APPROVED: { bg: '#dcfce7', fg: '#166534' },
  REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
  HOLD: { bg: '#ffedd5', fg: '#9a3412' },
  CANCELLED: { bg: '#f3f4f6', fg: '#6b7280' },
};

function round(n: number) {
  return Math.round(n);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

interface ComponentRow {
  salaryComponentId: number;
  name: string;
  currentAmount: number;
  revisedAmount: number;
}

function AddRevisionModal({
  isOpen,
  onClose,
  onCreated,
  employees,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  employees: EmployeeOption[];
}) {
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [revisionType, setRevisionType] = useState('ANNUAL_INCREMENT');
  const [revisionMethod, setRevisionMethod] = useState<'PERCENTAGE' | 'FIXED_AMOUNT' | 'REVISED_GROSS'>('PERCENTAGE');
  const [incrementPercent, setIncrementPercent] = useState<number | ''>('');
  const [incrementAmount, setIncrementAmount] = useState<number | ''>('');
  const [revisedGrossInput, setRevisedGrossInput] = useState<number | ''>('');
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [remarks, setRemarks] = useState('');
  const [current, setCurrent] = useState<CurrentSalary | null>(null);
  const [componentRows, setComponentRows] = useState<ComponentRow[]>([]);
  const [loadingSalary, setLoadingSalary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setEmployeeId('');
    setRevisionType('ANNUAL_INCREMENT');
    setRevisionMethod('PERCENTAGE');
    setIncrementPercent('');
    setIncrementAmount('');
    setRevisedGrossInput('');
    setEffectiveFrom(todayIso());
    setRemarks('');
    setCurrent(null);
    setComponentRows([]);
    setError(null);
  }, [isOpen]);

  useEffect(() => {
    if (!employeeId) {
      setCurrent(null);
      setComponentRows([]);
      return;
    }
    setLoadingSalary(true);
    fetch(`/api/employees/${employeeId}/salary`)
      .then((r) => r.json())
      .then((json: { data: CurrentSalary[] }) => {
        const latest = (json.data ?? []).find((r) => r) ?? null;
        setCurrent(latest);
      })
      .catch(() => setCurrent(null))
      .finally(() => setLoadingSalary(false));
  }, [employeeId]);

  const currentGross = current ? Number(current.grossSalary) : 0;

  let incrementAmountComputed = 0;
  let incrementPercentComputed = 0;
  let revisedGross = 0;
  if (revisionMethod === 'PERCENTAGE') {
    incrementPercentComputed = Number(incrementPercent) || 0;
    incrementAmountComputed = round(currentGross * (incrementPercentComputed / 100));
    revisedGross = currentGross + incrementAmountComputed;
  } else if (revisionMethod === 'FIXED_AMOUNT') {
    incrementAmountComputed = Number(incrementAmount) || 0;
    revisedGross = currentGross + incrementAmountComputed;
    incrementPercentComputed = currentGross > 0 ? Number(((incrementAmountComputed / currentGross) * 100).toFixed(2)) : 0;
  } else {
    revisedGross = Number(revisedGrossInput) || 0;
    incrementAmountComputed = revisedGross - currentGross;
    incrementPercentComputed = currentGross > 0 ? Number(((incrementAmountComputed / currentGross) * 100).toFixed(2)) : 0;
  }

  // Recompute the component grid whenever the derived revisedGross changes —
  // scales each current component proportionally (BRD §9's worked example),
  // still editable per-row afterward.
  useEffect(() => {
    if (!current) {
      setComponentRows([]);
      return;
    }
    const ratio = currentGross > 0 ? revisedGross / currentGross : 1;
    setComponentRows(
      current.components.map((c) => ({
        salaryComponentId: c.salaryComponentId,
        name: `${c.salaryComponent.name} (${c.salaryComponent.type})`,
        currentAmount: Number(c.amount),
        revisedAmount: round(Number(c.amount) * ratio),
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, revisedGross]);

  const submit = async (asSubmit: boolean) => {
    setError(null);
    if (!employeeId) {
      setError('Select an employee');
      return;
    }
    if (!current) {
      setError('This employee has no current salary structure to revise.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/payroll/revisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          revisionType,
          revisionMethod,
          incrementPercent: revisionMethod === 'PERCENTAGE' ? Number(incrementPercent) || 0 : undefined,
          incrementAmount: revisionMethod === 'FIXED_AMOUNT' ? Number(incrementAmount) || 0 : undefined,
          revisedGross: revisionMethod === 'REVISED_GROSS' ? Number(revisedGrossInput) || 0 : undefined,
          effectiveFrom,
          remarks: remarks || undefined,
          components: componentRows.map((c) => ({ salaryComponentId: c.salaryComponentId, revisedAmount: c.revisedAmount })),
          submit: asSubmit,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to create revision');
      }
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create revision');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Add Revision</h2>
          <button onClick={onClose} className="text-lg leading-none hover:opacity-70" style={{ color: 'var(--foreground-muted)' }}>×</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Employee <span className="text-red-500">*</span></label>
            <SearchableSelect
              value={employeeId}
              options={employees.map((e) => ({ label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`, value: e.id }))}
              onChange={(v) => setEmployeeId(v === '' ? '' : Number(v))}
            />
          </div>

          {loadingSalary && <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading current salary...</p>}
          {employeeId && !loadingSalary && !current && (
            <p className="text-sm" style={{ color: '#dc2626' }}>This employee has no current salary structure to revise.</p>
          )}

          {current && (
            <>
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Current Gross: <span className="font-medium" style={{ color: 'var(--foreground)' }}>₹{currentGross}</span></p>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Revision Type</label>
                  <select
                    value={revisionType}
                    onChange={(e) => setRevisionType(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                  >
                    <option value="ANNUAL_INCREMENT">Annual Increment</option>
                    <option value="PROMOTION">Promotion</option>
                    <option value="SPECIAL">Special</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Revision Method</label>
                  <select
                    value={revisionMethod}
                    onChange={(e) => setRevisionMethod(e.target.value as typeof revisionMethod)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                  >
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED_AMOUNT">Fixed Amount</option>
                    <option value="REVISED_GROSS">Revised Gross (direct)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {revisionMethod === 'PERCENTAGE' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Increment % <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      value={incrementPercent}
                      onChange={(e) => setIncrementPercent(e.target.value === '' ? '' : Number(e.target.value))}
                      className="rounded-lg border px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                    />
                  </div>
                )}
                {revisionMethod === 'FIXED_AMOUNT' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Increment Amount <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      value={incrementAmount}
                      onChange={(e) => setIncrementAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="rounded-lg border px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                    />
                  </div>
                )}
                {revisionMethod === 'REVISED_GROSS' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Revised Gross <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      value={revisedGrossInput}
                      onChange={(e) => setRevisedGrossInput(e.target.value === '' ? '' : Number(e.target.value))}
                      className="rounded-lg border px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                    />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Effective Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                  />
                </div>
              </div>

              <div className="rounded-lg px-3 py-2 text-sm flex justify-between" style={{ backgroundColor: 'var(--surface-hover)' }}>
                <span style={{ color: 'var(--foreground-muted)' }}>Increment Amount: ₹{incrementAmountComputed} ({incrementPercentComputed}%)</span>
                <span className="font-semibold" style={{ color: 'var(--foreground)' }}>Revised Gross: ₹{revisedGross}</span>
              </div>

              {componentRows.length > 0 && (
                <div>
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>Salary Components</h3>
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                          <th className="px-3 py-2 text-left" style={{ color: 'var(--foreground-muted)' }}>Component</th>
                          <th className="px-3 py-2 text-right" style={{ color: 'var(--foreground-muted)' }}>Existing</th>
                          <th className="px-3 py-2 text-right" style={{ color: 'var(--foreground-muted)' }}>Revised</th>
                        </tr>
                      </thead>
                      <tbody>
                        {componentRows.map((c, idx) => (
                          <tr key={c.salaryComponentId} style={{ borderTop: '1px solid var(--border)' }}>
                            <td className="px-3 py-1.5" style={{ color: 'var(--foreground)' }}>{c.name}</td>
                            <td className="px-3 py-1.5 text-right" style={{ color: 'var(--foreground-muted)' }}>{c.currentAmount}</td>
                            <td className="px-3 py-1.5 text-right">
                              <input
                                type="number"
                                value={c.revisedAmount}
                                onChange={(e) => {
                                  const v = Number(e.target.value) || 0;
                                  setComponentRows((prev) => prev.map((r, i) => (i === idx ? { ...r, revisedAmount: v } : r)));
                                }}
                                className="w-24 rounded border px-2 py-1 text-right text-sm"
                                style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                />
              </div>
            </>
          )}

          {error && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || !current}
              onClick={() => submit(false)}
              className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Save Draft
            </button>
            <button
              type="button"
              disabled={submitting || !current}
              onClick={() => submit(true)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {submitting ? 'Saving...' : 'Submit for Approval'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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

export default function SalaryRevisionPage() {
  const [records, setRecords] = useState<RevisionRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ row: RevisionRow; action: 'approve' | 'cancel' | 'release-hold' } | null>(null);
  const [reasonModal, setReasonModal] = useState<{ row: RevisionRow; action: 'reject' | 'hold' } | null>(null);

  useEffect(() => {
    fetch('/api/employees?limit=200')
      .then((r) => r.json())
      .then((json: { data: EmployeeOption[] }) => setEmployees(json.data ?? []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/payroll/revisions${statusFilter ? `?status=${statusFilter}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: { data: RevisionRow[] } = await res.json();
      setRecords(json.data);
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
    const res = await fetch(`/api/payroll/revisions/${id}/${path}`, {
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

  const columns: Column<RevisionRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'revisionType', label: 'Type' },
    { key: 'currentGross', label: 'Current Gross' },
    { key: 'revisedGross', label: 'Revised Gross' },
    { key: 'incrementPercent', label: 'Increment %' },
    { key: 'effectiveFrom', label: 'Effective From', render: (r) => new Date(r.effectiveFrom).toLocaleDateString() },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <span
          title={r.status === 'HOLD' ? (r.holdReason ?? undefined) : r.status === 'REJECTED' ? (r.rejectReason ?? undefined) : undefined}
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: STATUS_COLORS[r.status].bg, color: STATUS_COLORS[r.status].fg }}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: 'arrear',
      label: 'Arrear',
      render: (r) =>
        r.arrear ? (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>
            ₹{r.arrear.netArrearTotal} ({r.arrear.status})
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex gap-2 justify-end">
          {r.status === 'DRAFT' && (
            <>
              <button onClick={() => callAction(r.id, 'submit').catch((e) => setError(e.message))} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                Submit
              </button>
              <button onClick={() => setConfirm({ row: r, action: 'cancel' })} className="text-xs font-medium hover:underline text-red-500">
                Cancel
              </button>
            </>
          )}
          {r.status === 'SUBMITTED' && (
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
            <>
              <button onClick={() => setConfirm({ row: r, action: 'release-hold' })} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                Release Hold
              </button>
              <button onClick={() => setConfirm({ row: r, action: 'cancel' })} className="text-xs font-medium hover:underline text-red-500">
                Cancel
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Salary Revision</h1>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="HOLD">Hold</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <button
            onClick={() => setAddOpen(true)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Add Revision
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <DataTable columns={columns} data={records} loading={loading} emptyMessage="No salary revisions yet." />

      <AddRevisionModal isOpen={addOpen} onClose={() => setAddOpen(false)} onCreated={fetchData} employees={employees} />

      <ConfirmDialog
        isOpen={!!confirm}
        title={
          confirm?.action === 'approve' ? 'Approve Revision' : confirm?.action === 'release-hold' ? 'Release Hold' : 'Cancel Revision'
        }
        message={
          confirm?.action === 'approve'
            ? 'This will version the employee\'s salary and, if retroactive, generate an arrear. Continue?'
            : confirm?.action === 'release-hold'
              ? 'This revision will return to Submitted status.'
              : 'This revision request will be cancelled. This cannot be undone.'
        }
        confirmLabel={confirm?.action === 'approve' ? 'Approve' : confirm?.action === 'release-hold' ? 'Release' : 'Cancel Revision'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          const path = confirm.action;
          callAction(confirm.row.id, path).catch((e) => setError(e.message));
          setConfirm(null);
        }}
      />

      <ReasonModal
        isOpen={!!reasonModal}
        title={reasonModal?.action === 'reject' ? 'Reject Revision' : 'Hold Revision'}
        label={reasonModal?.action === 'reject' ? 'Reject Reason' : 'Hold Reason'}
        onClose={() => setReasonModal(null)}
        onSubmit={async (reason) => {
          if (!reasonModal) return;
          const key = reasonModal.action === 'reject' ? 'rejectReason' : 'holdReason';
          await callAction(reasonModal.row.id, reasonModal.action, { [key]: reason });
        }}
      />
    </div>
  );
}
