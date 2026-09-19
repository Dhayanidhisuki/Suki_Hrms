/**
 * Permission Policy & Usage — the HR/admin view. Sets the company's monthly
 * short-leave allowance and shows every employee's usage against it for a
 * chosen month.
 *
 * Employees apply on /ess/permission; the two-stage approval queue is
 * /approvals/workforce/permission. This page is neither — it is the policy
 * dial plus the company-wide picture of who is using it.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, useToast, type Column } from '@/components/ui';
import { handleExport } from '@/lib/export-utils';

interface UsageRow {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  department: string | null;
  approvedHours: number;
  pendingHours: number;
  usedHours: number;
  remainingHours: number;
  excessHours: number;
}

interface Totals {
  employees: number;
  usingPermission: number;
  overAllowance: number;
  totalHours: number;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i, 1).toLocaleString('default', { month: 'long' }),
}));

const hrs = (n: number) => `${Number(n).toFixed(2).replace(/\.00$/, '')}h`;

export default function PermissionPolicyPage() {
  const toast = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);

  const [rows, setRows] = useState<UsageRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [allowance, setAllowance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/permission/summary?year=${year}&month=${month}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const json: { data: UsageRow[]; totals: Totals; freeHoursPerMonth: number } = await res.json();
      setRows(json.data ?? []);
      setTotals(json.totals);
      setAllowance(json.freeHoursPerMonth);
      setDraft(String(json.freeHoursPerMonth));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [year, month, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const saveAllowance = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/masters/permission-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freeHoursPerMonth: Number(draft) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fe = body?.details?.fieldErrors as Record<string, string[]> | undefined;
        throw new Error(fe ? Object.values(fe).flat().join(', ') : body.error ?? 'Could not save');
      }
      toast.success(`Allowance set to ${hrs(Number(draft))} per month.`);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<UsageRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employeeCode} — ${r.employeeName}` },
    { key: 'department', label: 'Department', render: (r) => r.department ?? '—' },
    { key: 'approvedHours', label: 'Approved', render: (r) => hrs(r.approvedHours) },
    { key: 'pendingHours', label: 'Awaiting', render: (r) => hrs(r.pendingHours) },
    { key: 'usedHours', label: 'Used', render: (r) => <span className="font-semibold">{hrs(r.usedHours)}</span> },
    { key: 'remainingHours', label: 'Remaining', render: (r) => hrs(r.remainingHours) },
    {
      key: 'excessHours',
      label: 'Over Allowance',
      render: (r) =>
        r.excessHours > 0 ? (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
            +{hrs(r.excessHours)}
          </span>
        ) : (
          <span style={{ color: 'var(--foreground-muted)' }}>—</span>
        ),
    },
  ];

  const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Permission Policy &amp; Usage</h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Set the monthly short-leave allowance and see how much of it each employee has used. Employees spend it in
          any split they like; hours beyond the allowance are flagged, not deducted automatically.
        </p>
      </div>

      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
        <div className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Monthly Allowance</div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Hours per employee, per month</label>
            <input
              type="number"
              min="0"
              step="0.25"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-40 rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>
          <button
            onClick={saveAllowance}
            disabled={saving || draft === '' || Number(draft) === allowance}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {saving ? 'Saving…' : 'Save Allowance'}
          </button>
          <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            Applies to every employee in the company. Quarter-hour steps.
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </div>
        <div className="flex items-center gap-2">
          {(['csv', 'excel', 'pdf'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() =>
                handleExport({
                  filename: `permission-usage_${year}-${String(month).padStart(2, '0')}`,
                  data: rows.map((r) => ({
                    'Employee Code': r.employeeCode, Employee: r.employeeName, Department: r.department ?? '',
                    Approved: r.approvedHours, Awaiting: r.pendingHours, Used: r.usedHours,
                    Remaining: r.remainingHours, 'Over Allowance': r.excessHours,
                  })),
                  format: fmt,
                  title: `Permission Usage — ${MONTHS[month - 1].label} ${year}`,
                })
              }
              disabled={rows.length === 0}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--primary, #2563eb)' }}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {totals && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Employees</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{totals.employees}</div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Used Permission</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{totals.usingPermission}</div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Over Allowance</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: totals.overAllowance > 0 ? '#991b1b' : 'var(--foreground)' }}>
              {totals.overAllowance}
            </div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Total Hours</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{hrs(totals.totalHours)}</div>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        emptyMessage="No active employees."
      />
    </div>
  );
}
