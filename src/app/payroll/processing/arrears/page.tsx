/**
 * Salary Arrear — generated automatically when a Salary Revision is approved
 * with a retroactive effective date (see src/lib/arrearCalculation.ts).
 * Recalculate re-runs the month-wise calculation; Apply to Payroll pushes it
 * into a target (still-editable) PayrollRun as ad-hoc line items
 * (src/lib/arrearApply.ts). Both are blocked once APPLIED.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, type Column } from '@/components/ui';

interface ArrearRow {
  id: number;
  employee: { employeeCode: string; firstName: string; lastName: string };
  oldGross: string;
  revisedGross: string;
  arrearFromYear: number;
  arrearFromMonth: number;
  arrearToYear: number;
  arrearToMonth: number;
  grossArrearTotal: string;
  pfArrearTotal: string;
  esiArrearTotal: string;
  netArrearTotal: string;
  status: string;
}
interface ArrearMonthRow {
  year: number;
  month: number;
  oldGross: string;
  revisedGross: string;
  grossDifference: string;
  pfArrear: string;
  esiArrear: string;
  netArrear: string;
}
interface RunOption {
  id: number;
  year: number;
  month: number;
  status: string;
}

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(year: number, month: number) {
  return `${MONTH_NAMES[month]} ${year}`;
}

function ApplyModal({
  isOpen,
  onClose,
  onApply,
  runs,
}: {
  isOpen: boolean;
  onClose: () => void;
  onApply: (payrollRunId: number) => Promise<void>;
  runs: RunOption[];
}) {
  const editableRuns = runs.filter((r) => r.status === 'DRAFT' || r.status === 'CALCULATED');
  const [runId, setRunId] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRunId('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl shadow-2xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 space-y-3">
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Apply to Payroll</h2>
          {editableRuns.length === 0 ? (
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
                {editableRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {monthLabel(r.year, r.month)} ({r.status})
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

function MonthDetailModal({ arrearId, onClose }: { arrearId: number | null; onClose: () => void }) {
  const [months, setMonths] = useState<ArrearMonthRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!arrearId) return;
    setLoading(true);
    fetch(`/api/payroll/arrears/${arrearId}`)
      .then((r) => r.json())
      .then((json: { months: ArrearMonthRow[] }) => setMonths(json.months ?? []))
      .finally(() => setLoading(false));
  }, [arrearId]);

  if (!arrearId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl shadow-2xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Month-wise Arrear</h2>
          <button onClick={onClose} className="text-lg leading-none hover:opacity-70" style={{ color: 'var(--foreground-muted)' }}>×</button>
        </div>
        <div className="px-5 py-4">
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
                  <th className="px-2 py-2 text-left" style={{ color: 'var(--foreground-muted)' }}>Month</th>
                  <th className="px-2 py-2 text-right" style={{ color: 'var(--foreground-muted)' }}>Old Gross</th>
                  <th className="px-2 py-2 text-right" style={{ color: 'var(--foreground-muted)' }}>Revised Gross</th>
                  <th className="px-2 py-2 text-right" style={{ color: 'var(--foreground-muted)' }}>Diff</th>
                  <th className="px-2 py-2 text-right" style={{ color: 'var(--foreground-muted)' }}>PF</th>
                  <th className="px-2 py-2 text-right" style={{ color: 'var(--foreground-muted)' }}>ESI</th>
                  <th className="px-2 py-2 text-right" style={{ color: 'var(--foreground-muted)' }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={`${m.year}-${m.month}`} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-2 py-1.5" style={{ color: 'var(--foreground)' }}>{monthLabel(m.year, m.month)}</td>
                    <td className="px-2 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{m.oldGross}</td>
                    <td className="px-2 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{m.revisedGross}</td>
                    <td className="px-2 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{m.grossDifference}</td>
                    <td className="px-2 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{m.pfArrear}</td>
                    <td className="px-2 py-1.5 text-right" style={{ color: 'var(--foreground)' }}>{m.esiArrear}</td>
                    <td className="px-2 py-1.5 text-right font-medium" style={{ color: 'var(--foreground)' }}>{m.netArrear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SalaryArrearPage() {
  const [records, setRecords] = useState<ArrearRow[]>([]);
  const [runs, setRuns] = useState<RunOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [applyRow, setApplyRow] = useState<ArrearRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [arrearsRes, runsRes] = await Promise.all([fetch('/api/payroll/arrears'), fetch('/api/payroll/runs')]);
      if (!arrearsRes.ok) throw new Error('Failed to fetch arrears');
      const arrearsJson: { data: ArrearRow[] } = await arrearsRes.json();
      setRecords(arrearsJson.data);
      const runsJson: { data: RunOption[] } = await runsRes.json();
      setRuns(runsJson.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const recalculate = async (id: number) => {
    setError(null);
    const res = await fetch(`/api/payroll/arrears/${id}/recalculate`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Recalculate failed');
      return;
    }
    await fetchData();
  };

  const columns: Column<ArrearRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'oldGross', label: 'Old Gross' },
    { key: 'revisedGross', label: 'Revised Gross' },
    { key: 'period', label: 'Arrear Period', render: (r) => `${monthLabel(r.arrearFromYear, r.arrearFromMonth)} – ${monthLabel(r.arrearToYear, r.arrearToMonth)}` },
    { key: 'grossArrearTotal', label: 'Gross Arrear' },
    { key: 'pfArrearTotal', label: 'PF Arrear' },
    { key: 'esiArrearTotal', label: 'ESI Arrear' },
    { key: 'netArrearTotal', label: 'Net Arrear', className: 'font-medium' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: r.status === 'APPLIED' ? '#dcfce7' : '#fef9c3', color: r.status === 'APPLIED' ? '#166534' : '#854d0e' }}
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
          <button onClick={() => setDetailId(r.id)} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            Details
          </button>
          {r.status !== 'APPLIED' && (
            <>
              <button onClick={() => recalculate(r.id)} className="text-xs font-medium hover:underline" style={{ color: 'var(--foreground)' }}>
                Recalculate
              </button>
              <button onClick={() => setApplyRow(r)} className="text-xs font-medium hover:underline" style={{ color: '#166534' }}>
                Apply to Payroll
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Salary Arrear</h1>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <DataTable columns={columns} data={records} loading={loading} emptyMessage="No arrears — approve a retroactive salary revision to generate one." />

      <MonthDetailModal arrearId={detailId} onClose={() => setDetailId(null)} />

      <ApplyModal
        isOpen={!!applyRow}
        onClose={() => setApplyRow(null)}
        runs={runs}
        onApply={async (payrollRunId) => {
          if (!applyRow) return;
          const res = await fetch(`/api/payroll/arrears/${applyRow.id}/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payrollRunId }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error ?? 'Apply failed');
          }
          await fetchData();
        }}
      />
    </div>
  );
}
