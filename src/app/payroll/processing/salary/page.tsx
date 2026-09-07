/**
 * Payroll Run — select/create a year+month run, Calculate, review the
 * employee grid (gross/OT/PF/ESI/PT/TDS/net, HOLD rows flagged), Approve,
 * Lock. Standard DataTable list pattern, not a novel grid like Attendance's
 * monthly workbench.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { DataTable, type Column } from '@/components/ui';

interface PayrollLine {
  id: number;
  employeeId: number;
  totalWorkingDays: number;
  payableDays: string;
  lopDays: number;
  grossEarnings: string;
  otAmount: string;
  pfEmployee: string;
  esiEmployee: string;
  professionalTax: string;
  tds: string;
  otherEarningsTotal: string;
  otherDeductionsTotal: string;
  netSalary: string;
  status: string;
  holdReason: string | null;
  employee: { id: number; employeeCode: string; firstName: string; lastName: string };
}

interface PayrollRun {
  id: number;
  year: number;
  month: number;
  status: 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'LOCKED';
  lines: PayrollLine[];
}

interface RunSummary {
  id: number;
  year: number;
  month: number;
  status: string;
}

const now = new Date();
const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: '#f3f4f6', fg: '#4b5563' },
  CALCULATED: { bg: '#fef9c3', fg: '#854d0e' },
  APPROVED: { bg: '#dbeafe', fg: '#1e40af' },
  LOCKED: { bg: '#fee2e2', fg: '#991b1b' },
};

export default function PayrollSalaryPage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const listRes = await fetch('/api/payroll/runs');
      if (!listRes.ok) throw new Error('Failed to fetch runs');
      const { data }: { data: RunSummary[] } = await listRes.json();
      const match = data.find((r) => r.year === year && r.month === month);
      if (!match) {
        setRun(null);
        return;
      }
      const runRes = await fetch(`/api/payroll/runs/${match.id}`);
      if (!runRes.ok) throw new Error('Failed to fetch run');
      setRun(await runRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  const runAction = async (url: string, method: string, body?: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Action failed');
      setSuccessMessage(json.message ?? 'Done');
      await fetchRun();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<PayrollLine>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'payableDays', label: 'Payable Days', render: (r) => `${r.payableDays}/${r.totalWorkingDays}` },
    { key: 'lopDays', label: 'LOP' },
    { key: 'grossEarnings', label: 'Gross' },
    { key: 'otAmount', label: 'OT' },
    { key: 'pfEmployee', label: 'PF' },
    { key: 'esiEmployee', label: 'ESI' },
    { key: 'professionalTax', label: 'PT' },
    { key: 'tds', label: 'TDS' },
    { key: 'netSalary', label: 'Net Salary', className: 'font-medium' },
    {
      key: 'status',
      label: 'Status',
      render: (r) =>
        r.status === 'HOLD' ? (
          <span title={r.holdReason ?? undefined} className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
            HOLD
          </span>
        ) : (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
            OK
          </span>
        ),
    },
    {
      key: 'payslip',
      label: 'Payslip',
      render: (r) => (
        <Link href={`/payroll/outputs/payslip?runId=${run?.id}&lineId=${r.id}`} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
          View
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Salary Processing
        </h1>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          />
          {run && (
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: STATUS_COLORS[run.status].bg, color: STATUS_COLORS[run.status].fg }}
            >
              {run.status}
            </span>
          )}

          {!run && !loading && (
            <button
              disabled={busy}
              onClick={() => runAction('/api/payroll/runs', 'POST', { year, month })}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Create Run
            </button>
          )}
          {run && (run.status === 'DRAFT' || run.status === 'CALCULATED') && (
            <button
              disabled={busy}
              onClick={() => runAction(`/api/payroll/runs/${run.id}/calculate`, 'POST')}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Calculate
            </button>
          )}
          {run && run.status === 'CALCULATED' && (
            <button
              disabled={busy}
              onClick={() => runAction(`/api/payroll/runs/${run.id}/approve`, 'POST')}
              className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Approve
            </button>
          )}
          {run && run.status === 'APPROVED' && (
            <button
              disabled={busy}
              onClick={() => runAction(`/api/payroll/runs/${run.id}/lock`, 'POST')}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#991b1b' }}
            >
              Lock
            </button>
          )}
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
          <button onClick={() => setSuccessMessage(null)} className="text-xs font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {!run && !loading ? (
        <div className="rounded-lg border px-4 py-8 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
          No payroll run exists for {new Date(2000, month - 1, 1).toLocaleString('default', { month: 'long' })} {year} yet.
        </div>
      ) : (
        <DataTable columns={columns} data={run?.lines ?? []} loading={loading} emptyMessage="No employees calculated yet — click Calculate." />
      )}
    </div>
  );
}
