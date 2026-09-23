/**
 * Payroll Additions & Deductions — manual entry workbench.
 *
 * Select a payroll run, pick an employee, then add or remove one-off
 * earning/deduction line items (PayrollLineComponent.isAdhoc). These feed
 * directly into the payslip's "Other Earnings" and "Other Deductions".
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { DataTable, useToast, type Column } from '@/components/ui';

interface SalaryComponentOption {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface PayrollLineComponent {
  id: number;
  amount: string;
  isAdhoc: boolean;
  salaryComponent: SalaryComponentOption;
}

interface PayrollLine {
  id: number;
  employeeId: number;
  employee: { id: number; oldEmployeeCode: string | null; firstName: string; lastName: string };
  otherEarningsTotal: string;
  otherDeductionsTotal: string;
  components: PayrollLineComponent[];
}

interface PayrollRun {
  id: number;
  year: number;
  month: number;
  status: string;
  lines: PayrollLine[];
}

interface RunSummary {
  id: number;
  year: number;
  month: number;
  status: string;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: '#f3f4f6', fg: '#4b5563' },
  CALCULATED: { bg: '#fef9c3', fg: '#854d0e' },
  APPROVED: { bg: '#dbeafe', fg: '#1e40af' },
  LOCKED: { bg: '#fee2e2', fg: '#991b1b' },
};

function AdditionsDeductionsContent() {
  const toast = useToast();
  const search = useSearchParams();
  const initialRunId = Number(search.get('runId')) || undefined;

  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | undefined>(initialRunId);
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [components, setComponents] = useState<SalaryComponentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [selectedLine, setSelectedLine] = useState<PayrollLine | null>(null);
  const [componentId, setComponentId] = useState('');
  const [amount, setAmount] = useState('');

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/payroll/runs');
      if (!res.ok) throw new Error('Failed to fetch runs');
      const { data }: { data: RunSummary[] } = await res.json();
      setRuns(data);
      if (!selectedRunId && data.length > 0) setSelectedRunId(data[0].id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load runs');
    }
  }, [selectedRunId, toast]);

  const fetchRun = useCallback(async () => {
    if (!selectedRunId) return;
    setLoading(true);
    try {
      const [runRes, compRes] = await Promise.all([
        fetch(`/api/payroll/runs/${selectedRunId}`),
        fetch('/api/masters/salary-components?limit=500'),
      ]);
      if (!runRes.ok) throw new Error('Failed to fetch run');
      setRun(await runRes.json());
      const compJson = await compRes.json();
      setComponents((compJson.data ?? []).filter((c: SalaryComponentOption) => c.type === 'earning' || c.type === 'deduction'));
      setSelectedLine(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load run');
    } finally {
      setLoading(false);
    }
  }, [selectedRunId, toast]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);
  useEffect(() => { fetchRun(); }, [fetchRun]);

  const isEditable = run && (run.status === 'DRAFT' || run.status === 'CALCULATED');

  const handleAdd = async () => {
    if (!selectedLine || !componentId || !amount) return;
    const component = components.find((c) => String(c.id) === componentId);
    if (!component) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/payroll/runs/${selectedRunId}/lines/${selectedLine.id}/adhoc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salaryComponentId: Number(componentId), amount: Number(amount) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Add failed');
      toast.success(`${component.name} added for ${selectedLine.employee.firstName}`);
      setAmount('');
      setComponentId('');
      await fetchRun();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Add failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (lineId: number, row: PayrollLineComponent) => {
    if (!isEditable) return;
    if (!confirm(`Remove ${row.salaryComponent.name} (${row.amount})?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/payroll/runs/${selectedRunId}/lines/${lineId}/adhoc?componentId=${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Delete failed');
      toast.success('Entry removed');
      await fetchRun();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const lineColumns: Column<PayrollLine>[] = [
    { key: 'employee', label: 'Employee', render: (r) => r.employee.oldEmployeeCode ? `${r.employee.oldEmployeeCode} — ${r.employee.firstName} ${r.employee.lastName}` : `${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'otherEarningsTotal', label: 'Other Earnings' },
    { key: 'otherDeductionsTotal', label: 'Other Deductions' },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <button
          onClick={() => { setSelectedLine(r); setComponentId(''); setAmount(''); }}
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          Manage
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Additions & Deductions
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            One-off earnings and deductions for a payroll run.
          </p>
        </div>
        <Link
          href="/payroll/processing/salary"
          className="rounded-lg border px-4 py-2 text-sm font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          Back to Salary Processing
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={selectedRunId ?? ''}
          onChange={(e) => setSelectedRunId(Number(e.target.value))}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
        >
          <option value="">Select a payroll run</option>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {new Date(2000, r.month - 1, 1).toLocaleString('default', { month: 'long' })} {r.year} — {r.status}
            </option>
          ))}
        </select>
        {run && (
          <span
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{ backgroundColor: STATUS_COLORS[run.status]?.bg ?? '#f3f4f6', color: STATUS_COLORS[run.status]?.fg ?? '#4b5563' }}
          >
            {run.status}
          </span>
        )}
      </div>

      {!run ? (
        <div className="rounded-lg border px-4 py-8 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
          Select a payroll run to manage additions and deductions.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <DataTable columns={lineColumns} data={run.lines} loading={loading} emptyMessage="No employees in this run yet." />
          </div>

          <div className="rounded-lg border p-4 space-y-4" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {selectedLine ? selectedLine.employee.oldEmployeeCode ? `${selectedLine.employee.oldEmployeeCode} — ${selectedLine.employee.firstName}` : selectedLine.employee.firstName : 'Select an employee'}
            </h2>

            {selectedLine ? (
              <>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {selectedLine.components
                    .filter((c) => c.isAdhoc)
                    .map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <div className="font-medium" style={{ color: 'var(--foreground)' }}>{c.salaryComponent.name}</div>
                          <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                            {c.salaryComponent.type} · {c.amount}
                          </div>
                        </div>
                        {isEditable && (
                          <button
                            onClick={() => handleDelete(selectedLine.id, c)}
                            disabled={busy}
                            className="text-xs font-medium hover:underline"
                            style={{ color: 'var(--danger)' }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  {selectedLine.components.filter((c) => c.isAdhoc).length === 0 && (
                    <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No ad-hoc entries for this employee.</p>
                  )}
                </div>

                {isEditable ? (
                  <div className="space-y-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Component</label>
                      <select
                        value={componentId}
                        onChange={(e) => setComponentId(e.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                      >
                        <option value="">— Select component —</option>
                        {components.map((c) => (
                          <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Amount</label>
                      <input
                        type="number"
                        min={0}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Positive amount"
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                      />
                      <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
                        The sign is taken from the component type (earning/deduction).
                      </p>
                    </div>
                    <button
                      onClick={handleAdd}
                      disabled={busy || !componentId || !amount}
                      className="w-full rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      {busy ? 'Adding…' : 'Add Entry'}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                    This run is {run.status}. Additions and deductions can only be edited while DRAFT or CALCULATED.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                Click "Manage" on an employee to view or edit their ad-hoc additions/deductions.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdditionsDeductionsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>}>
      <AdditionsDeductionsContent />
    </Suspense>
  );
}
