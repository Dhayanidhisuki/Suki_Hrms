/**
 * Time Office Final — per-employee attendance grid for a month, showing
 * all Time Office metrics (days, OT, late, early, permission, comp-off).
 * HR reviews this before running payroll.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, type Column } from '@/components/ui';

interface TimeOfficeRow {
  id: number;
  employeeId: number;
  employeeCode: string;
  name: string;
  totalWorkingDays: number;
  payableDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  lopDays: number;
  otHours: number;
  otPayableHours: number;
  lomMinutes: number;
  lateMinutes: number;
  earlyOutMinutes: number;
  permissionHours: number;
  permissionExcessHours: number;
  compOffBalance: number;
  summaryStatus: string;
  weeklyOtCapHours: number | null;
  exceedsWeeklyCap: boolean;
  [key: string]: unknown;
}

const columns: Column<TimeOfficeRow>[] = [
  { key: 'employeeCode', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'payableDays', label: 'Payable', sortable: true },
  { key: 'lopDays', label: 'LOP', sortable: true },
  { key: 'otHours', label: 'OT Hrs (raw)', sortable: true },
  { key: 'otPayableHours', label: 'OT Pay Hrs', sortable: true },
  { key: 'lomMinutes', label: 'LOM (min)', sortable: true },
  { key: 'lateMinutes', label: 'Late (min)', sortable: true },
  { key: 'earlyOutMinutes', label: 'Early (min)', sortable: true },
  { key: 'permissionHours', label: 'Perm (hrs)', sortable: true },
  { key: 'permissionExcessHours', label: 'Perm Excess', sortable: true },
  { key: 'compOffBalance', label: 'Comp-Off', sortable: true },
  { key: 'summaryStatus', label: 'Status', sortable: true },
];

export default function TimeOfficeFinalPage() {
  const [rows, setRows] = useState<TimeOfficeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [month, setMonth] = useState(new Date().getUTCMonth() + 1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workforce/attendance/time-office-final?year=${year}&month=${month}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setRows(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const exceedsCapCount = rows.filter((r) => r.exceedsWeeklyCap).length;
  const openCount = rows.filter((r) => r.summaryStatus === 'OPEN').length;
  const totalLopDays = rows.reduce((sum, r) => sum + r.lopDays, 0);
  const totalOtHours = rows.reduce((sum, r) => sum + r.otHours, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Time Office Final</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Per-employee attendance grid for the month. Review before payroll processing.
        </p>
      </div>

      {/* Period selector */}
      <div className="flex gap-3 items-end">
        <div>
          <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="mt-1 w-24 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
          />
        </div>
        <div>
          <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="mt-1 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Employees</p>
          <p className="text-2xl font-semibold mt-1">{rows.length}</p>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Open Summaries</p>
          <p className="text-2xl font-semibold mt-1" style={{ color: openCount > 0 ? 'var(--warning)' : 'var(--success)' }}>{openCount}</p>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Total LOP Days</p>
          <p className="text-2xl font-semibold mt-1">{totalLopDays}</p>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Exceed Weekly OT Cap</p>
          <p className="text-2xl font-semibold mt-1" style={{ color: exceedsCapCount > 0 ? 'var(--danger)' : 'var(--success)' }}>{exceedsCapCount}</p>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          emptyMessage="No attendance data for this period"
        />
      )}
    </div>
  );
}
