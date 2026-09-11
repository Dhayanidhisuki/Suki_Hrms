/**
 * Dashboard — Pending Salary
 *
 * Shows every payroll run that has employee lines still on HOLD (attendance
 * not finalized, or no salary revision), grouped by run month. Includes:
 *   • KPI summary strip (total HOLD, total OK, % pending, net-at-risk)
 *   • Month tabs
 *   • Employee-level table: who is on HOLD, why, and quick-links to fix
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { KPIGrid, KPICard, DataTable, Spinner } from '@/components/ui';
import type { Column } from '@/components/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HoldEmployee {
  id: number;
  lineId: number;
  employeeId: number;
  employeeCode: string;
  name: string;
  holdReason: string | null;
  grossEarnings: string;
  attendanceStatus: string | null;
}

interface RunSummary {
  id: number;
  year: number;
  month: number;
  status: string;
  totalLines: number;
  holdLines: number;
  okLines: number;
  netAtRisk: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const now = new Date();

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  DRAFT:      { bg: '#f3f4f6', fg: '#4b5563', label: 'Draft' },
  CALCULATED: { bg: '#fef9c3', fg: '#854d0e', label: 'Calculated' },
  APPROVED:   { bg: '#dbeafe', fg: '#1e40af', label: 'Approved' },
  LOCKED:     { bg: '#fee2e2', fg: '#991b1b', label: 'Locked' },
};

const ATT_PILL: Record<string, { bg: string; fg: string }> = {
  OPEN:      { bg: '#fef9c3', fg: '#854d0e' },
  FINALIZED: { bg: '#dcfce7', fg: '#166534' },
  FROZEN:    { bg: '#dbeafe', fg: '#1e40af' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '₹0';
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PendingSalaryPage() {
  const [year, setYear]                   = useState(now.getFullYear());
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [runs, setRuns]                   = useState<RunSummary[]>([]);
  const [holdEmployees, setHoldEmployees] = useState<HoldEmployee[]>([]);
  const [loading, setLoading]             = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  // Load all runs for the selected year
  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payroll/runs');
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Unauthorized — please log in or re-authenticate.');
        }
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? `Failed to fetch payroll runs (HTTP ${res.status})`);
      }
      const { data }: { data: Array<{ id: number; year: number; month: number; status: string; _count: { lines: number } }> }
        = await res.json();

      const yearRuns = data.filter((r) => r.year === year);
      setRuns(yearRuns.map((r) => ({
        id: r.id, year: r.year, month: r.month, status: r.status,
        totalLines: r._count?.lines ?? 0, holdLines: 0, okLines: 0, netAtRisk: 0,
      })));

      const currentMonthRun = yearRuns.find((r) => r.month === now.getMonth() + 1);
      const auto = currentMonthRun ?? yearRuns[0];
      if (auto) setSelectedRunId(auto.id);
      else { setSelectedRunId(null); setHoldEmployees([]); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [year]);

  // Load detail for selected run
  const fetchRunDetail = useCallback(async (runId: number) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/payroll/runs/${runId}`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? `Failed to fetch run detail (HTTP ${res.status})`);
      }
      const run: {
        id: number; year: number; month: number; status: string;
        lines: Array<{
          id: number; employeeId: number; status: string; holdReason: string | null;
          grossEarnings: string; netSalary: string;
          employee: { id: number; employeeCode: string; firstName: string; lastName: string };
        }>;
      } = await res.json();

      setRuns((prev) => prev.map((r) => {
        if (r.id !== runId) return r;
        const holdLines = run.lines.filter((l) => l.status === 'HOLD').length;
        const okLines   = run.lines.filter((l) => l.status !== 'HOLD').length;
        const netAtRisk = run.lines.filter((l) => l.status === 'HOLD')
          .reduce((s, l) => s + parseFloat(l.grossEarnings || '0'), 0);
        return { ...r, holdLines, okLines, netAtRisk };
      }));

      const holdLines = run.lines.filter((l) => l.status === 'HOLD');

      // Fetch attendance status for hold employees
      let attMap: Record<number, string> = {};
      if (holdLines.length > 0) {
        try {
          const attRes = await fetch(`/api/workforce/attendance/monthly?year=${run.year}&month=${run.month}`);
          if (attRes.ok) {
            const attData: { data: Array<{ employeeId: number; summary: { status: string } | null }> }
              = await attRes.json();
            attMap = Object.fromEntries(attData.data.map((e) => [e.employeeId, e.summary?.status ?? 'OPEN']));
          }
        } catch { /* non-critical */ }
      }

      setHoldEmployees(holdLines.map((l) => ({
        id: l.id,
        lineId: l.id, employeeId: l.employee.id,
        employeeCode: l.employee.employeeCode,
        name: `${l.employee.firstName} ${l.employee.lastName}`.trim(),
        holdReason: l.holdReason,
        grossEarnings: l.grossEarnings,
        attendanceStatus: attMap[l.employee.id] ?? null,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);
  useEffect(() => { if (selectedRunId !== null) fetchRunDetail(selectedRunId); }, [selectedRunId, fetchRunDetail]);

  // Derived values
  const selectedRun    = runs.find((r) => r.id === selectedRunId) ?? null;
  const totalHold      = selectedRun?.holdLines ?? 0;
  const totalOk        = selectedRun?.okLines   ?? 0;
  const totalEmployees = (selectedRun?.totalLines ?? 0) || totalHold + totalOk;
  const pctPending     = totalEmployees > 0 ? Math.round((totalHold / totalEmployees) * 100) : 0;
  const netAtRisk      = selectedRun?.netAtRisk ?? 0;

  // Table columns
  const columns: Column<HoldEmployee>[] = [
    {
      key: 'employeeCode', label: 'Emp Code',
      render: (row) => (
        <span className="font-mono text-xs" style={{ color: 'var(--foreground-muted)' }}>
          {row.employeeCode}
        </span>
      ),
    },
    {
      key: 'name', label: 'Employee',
      render: (row) => (
        <span className="font-medium" style={{ color: 'var(--foreground)' }}>{row.name}</span>
      ),
    },
    {
      key: 'holdReason', label: 'Hold Reason',
      render: (row) => (
        <span className="text-sm" style={{ color: '#dc2626' }}>{row.holdReason ?? '—'}</span>
      ),
    },
    {
      key: 'attendanceStatus', label: 'Attendance',
      render: (row) => {
        const s = row.attendanceStatus;
        if (!s) return <span style={{ color: 'var(--foreground-muted)' }}>—</span>;
        const p = ATT_PILL[s];
        return (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: p?.bg ?? '#f3f4f6', color: p?.fg ?? '#4b5563' }}>
            {s}
          </span>
        );
      },
    },
    {
      key: 'grossEarnings', label: 'Gross', className: 'text-right',
      render: (row) => (
        <span className="font-medium tabular-nums" style={{ color: 'var(--foreground)' }}>
          {fmt(row.grossEarnings)}
        </span>
      ),
    },
    {
      key: 'action', label: 'Fix',
      render: (row) => {
        const s = row.attendanceStatus;
        if (!s || s === 'OPEN') {
          return (
            <Link href="/workforce/attendance/monthly"
              className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
              Finalize Attendance →
            </Link>
          );
        }
        return (
          <Link href="/payroll/processing/salary"
            className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
            Recalculate →
          </Link>
        );
      },
    },
  ];

  // Render
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--foreground-muted)' }}>
            Dashboard · Payroll
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Pending Salary
          </h1>
        </div>
        <input type="number" value={year} min={2020} max={2030}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-24 rounded-lg border px-3 py-2 text-sm"
          style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }} />
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner /></div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border px-6 py-16 text-center"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
            No payroll runs found for {year}.
          </p>
          <Link href="/payroll/processing/salary"
            className="mt-4 inline-block rounded-full px-5 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--accent)' }}>
            Create a Payroll Run →
          </Link>
        </div>
      ) : (
        <>
          {/* Month tab strip */}
          <div className="flex flex-wrap gap-2">
            {runs.map((r) => {
              const isSelected = r.id === selectedRunId;
              const pill = STATUS_PILL[r.status] ?? STATUS_PILL.DRAFT;
              return (
                <button key={r.id} onClick={() => setSelectedRunId(r.id)}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition"
                  style={{
                    backgroundColor: isSelected ? 'var(--accent)' : 'var(--surface)',
                    color: isSelected ? '#fff' : 'var(--foreground)',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                  }}>
                  {MONTHS[r.month - 1]}
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : pill.bg, color: isSelected ? '#fff' : pill.fg }}>
                    {r.status}
                  </span>
                </button>
              );
            })}
          </div>

          {/* KPI cards */}
          <KPIGrid>
            <KPICard
              label="Employees on Hold"
              value={totalHold}
              tone={totalHold > 0 ? 'danger' : 'success'}
              subtitle={totalHold > 0 ? `${pctPending}% of total workforce` : 'All cleared ✓'}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              }
            />
            <KPICard
              label="Salary Cleared"
              value={totalOk}
              tone="success"
              subtitle={`of ${totalEmployees} total employees`}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              }
            />
            <KPICard
              label="Gross at Risk"
              value={fmt(netAtRisk)}
              tone={netAtRisk > 0 ? 'warning' : 'success'}
              subtitle="Sum of gross for HOLD employees"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              }
            />
            <KPICard
              label="Run Status"
              value={selectedRun?.status ?? '—'}
              tone={selectedRun?.status === 'LOCKED' ? 'danger' : selectedRun?.status === 'APPROVED' ? 'info' : selectedRun?.status === 'CALCULATED' ? 'warning' : 'info'}
              subtitle={selectedRun ? `${MONTHS[selectedRun.month - 1]} ${selectedRun.year}` : '—'}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              }
            />
          </KPIGrid>

          {/* HOLD table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                Employees on Hold
                {totalHold > 0 && (
                  <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-bold"
                    style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                    {totalHold}
                  </span>
                )}
              </h2>
              <Link href="/payroll/processing/salary"
                className="rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)', backgroundColor: 'var(--surface)' }}>
                Open Payroll Run →
              </Link>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-10"><Spinner /></div>
            ) : totalHold === 0 ? (
              <div className="rounded-xl border px-6 py-10 text-center"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  All employees cleared
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  No pending salary for {selectedRun ? `${MONTHS[selectedRun.month - 1]} ${selectedRun.year}` : 'this period'}.
                </p>
              </div>
            ) : (
              <DataTable columns={columns} data={holdEmployees} loading={false} emptyMessage="No employees on hold." rowKey={(r) => r.lineId} />
            )}
          </div>

          {/* All-runs overview table */}
          {runs.length > 1 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground-muted)' }}>
                All Runs — {year}
              </h2>
              <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                      <th className="px-4 py-3">Month</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Employees</th>
                      <th className="px-4 py-3 text-right">On Hold</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => {
                      const pill = STATUS_PILL[r.status] ?? STATUS_PILL.DRAFT;
                      return (
                        <tr key={r.id} className="border-b cursor-pointer transition hover:opacity-80"
                          style={{ borderColor: 'var(--border)', backgroundColor: r.id === selectedRunId ? 'var(--surface-hover)' : undefined }}
                          onClick={() => setSelectedRunId(r.id)}>
                          <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>
                            {MONTHS[r.month - 1]} {r.year}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{ backgroundColor: pill.bg, color: pill.fg }}>
                              {pill.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--foreground-muted)' }}>
                            {r.totalLines}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {r.holdLines > 0 ? (
                              <span className="rounded-full px-2 py-0.5 text-xs font-bold"
                                style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                                {r.holdLines}
                              </span>
                            ) : r.totalLines > 0 ? (
                              <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                                ✓ Clear
                              </span>
                            ) : (
                              <span style={{ color: 'var(--foreground-muted)' }}>—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={(e) => { e.stopPropagation(); setSelectedRunId(r.id); }}
                              className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
