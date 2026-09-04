/**
 * Monthly Attendance — the employee × date workbench (BRD §4). No existing
 * shared component renders this shape (DataTable assumes a modest static
 * column set), so this is a purpose-built grid on a plain <table>, not
 * DataTable. Color thresholds and column set are the Phase 1 subset of the
 * BRD's spec — biometric sync, the full column selector, and per-cell
 * correction-in-place are deferred; correction happens on the Daily
 * Attendance page.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FormModal, type FieldDef } from '@/components/ui';

interface DayRecord {
  id: number;
  date: string;
  status: string;
  inTime: string | null;
  outTime: string | null;
  workingMinutes: number;
  lateMinutes: number;
  earlyOutMinutes: number;
  otMinutesCalculated: number;
  otMinutesApproved: number | null;
  remarks: string | null;
}

interface EmployeeMonth {
  employeeId: number;
  employeeCode: string;
  name: string;
  days: DayRecord[];
  summary: { status: 'OPEN' | 'FINALIZED' | 'FROZEN' } | null;
}

interface GridResponse {
  data: EmployeeMonth[];
  year: number;
  month: number;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function cellColor(day: DayRecord | undefined): string {
  if (!day) return 'transparent';
  if (day.status === 'WeeklyOff' || day.status === 'Holiday') return '#dbeafe';
  if (day.status === 'Leave') return '#e9d5ff';
  if (day.status === 'Permission') return '#fde68a';
  const hours = day.workingMinutes / 60;
  if (hours === 0) return '#fecaca';
  if (hours < 4) return '#fed7aa';
  if (hours < 6) return '#fef08a';
  if (hours < 8) return '#bbf7d0';
  return '#4ade80';
}

function cellLabel(day: DayRecord | undefined): string {
  if (!day) return '';
  if (day.status === 'WeeklyOff') return 'WO';
  if (day.status === 'Holiday') return 'HO';
  if (day.status === 'Leave') return 'LV';
  if (day.status === 'Absent') return 'A';
  if (day.status === 'MissingPunch') return 'MP';
  const h = Math.floor(day.workingMinutes / 60);
  const m = day.workingMinutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function cellTooltip(day: DayRecord | undefined, dateLabel: string): string {
  if (!day) return dateLabel;
  const fmt = (t: string | null) => (t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--');
  return [
    dateLabel,
    `Status: ${day.status}`,
    `In: ${fmt(day.inTime)}  Out: ${fmt(day.outTime)}`,
    `Late: ${day.lateMinutes}m  Early-Out: ${day.earlyOutMinutes}m`,
    `OT: ${day.otMinutesApproved ?? day.otMinutesCalculated}m`,
    day.remarks ? `Remarks: ${day.remarks}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const now = new Date();

export default function MonthlyAttendancePage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<EmployeeMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);

  const numDays = daysInMonth(year, month);
  const dayList = useMemo(() => Array.from({ length: numDays }, (_, i) => i + 1), [numDays]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workforce/attendance/monthly?year=${year}&month=${month}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: GridResponse = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Every employee shares the same month's freeze status in this Phase 1
  // model (finalize/freeze act on the whole company at once) — take the
  // first row's status as representative, defaulting to OPEN before any
  // finalize has run.
  const monthStatus = data[0]?.summary?.status ?? 'OPEN';

  const runAction = async (url: string, body: Record<string, unknown>, successMsg: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Action failed');
      setSuccessMessage(json.message ?? successMsg);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const reopenFields: FieldDef[] = [{ name: 'reason', label: 'Reopen Reason', type: 'textarea', required: true }];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Monthly Attendance
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
          <span
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{
              backgroundColor: monthStatus === 'FROZEN' ? '#fee2e2' : monthStatus === 'FINALIZED' ? '#fef9c3' : '#dcfce7',
              color: monthStatus === 'FROZEN' ? '#991b1b' : monthStatus === 'FINALIZED' ? '#854d0e' : '#166534',
            }}
          >
            {monthStatus === 'FROZEN' ? '🔒 Frozen' : monthStatus}
          </span>
          {monthStatus === 'OPEN' && (
            <button
              disabled={busy}
              onClick={() => runAction('/api/workforce/attendance/monthly/finalize', { year, month }, 'Finalized')}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Finalize
            </button>
          )}
          {monthStatus === 'FINALIZED' && (
            <button
              disabled={busy}
              onClick={() => runAction('/api/workforce/attendance/monthly/freeze', { year, month }, 'Frozen')}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#991b1b' }}
            >
              Freeze
            </button>
          )}
          {monthStatus === 'FROZEN' && (
            <button
              disabled={busy}
              onClick={() => setReopenModalOpen(true)}
              className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Reopen
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

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <table className="text-xs">
          <thead>
            <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
              <th className="sticky left-0 z-10 px-3 py-2 text-left font-medium" style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--foreground-muted)' }}>
                Employee
              </th>
              {dayList.map((d) => (
                <th key={d} className="px-2 py-2 text-center font-medium" style={{ color: 'var(--foreground-muted)' }}>
                  {d}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--foreground-muted)' }}>
                Late (m)
              </th>
              <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--foreground-muted)' }}>
                Total (h)
              </th>
              <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--foreground-muted)' }}>
                OT (h)
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={numDays + 4} className="px-4 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={numDays + 4} className="px-4 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
                  No employees found.
                </td>
              </tr>
            ) : (
              data.map((emp) => {
                const byDate = new Map(emp.days.map((d) => [d.date.slice(0, 10), d]));
                let totalMinutes = 0;
                let lateMinutes = 0;
                let otMinutes = 0;
                for (const d of emp.days) {
                  totalMinutes += d.workingMinutes;
                  lateMinutes += d.lateMinutes;
                  otMinutes += d.otMinutesApproved ?? d.otMinutesCalculated;
                }
                return (
                  <tr key={emp.employeeId} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="sticky left-0 z-10 whitespace-nowrap px-3 py-1.5" style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}>
                      {emp.employeeCode} — {emp.name}
                    </td>
                    {dayList.map((d) => {
                      const iso = isoDate(year, month, d);
                      const day = byDate.get(iso);
                      return (
                        <td
                          key={d}
                          title={cellTooltip(day, iso)}
                          className="px-1 py-1.5 text-center"
                          style={{ backgroundColor: cellColor(day), color: '#1f2937', minWidth: 40 }}
                        >
                          {cellLabel(day)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-1.5 text-center" style={{ color: 'var(--foreground)' }}>
                      {lateMinutes}
                    </td>
                    <td className="px-3 py-1.5 text-center" style={{ color: 'var(--foreground)' }}>
                      {(totalMinutes / 60).toFixed(1)}
                    </td>
                    <td className="px-3 py-1.5 text-center" style={{ color: 'var(--foreground)' }}>
                      {(otMinutes / 60).toFixed(1)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <FormModal
        title="Reopen Month"
        fields={reopenFields}
        initialValues={{}}
        isOpen={reopenModalOpen}
        onClose={() => setReopenModalOpen(false)}
        onSubmit={async (values) => {
          await runAction('/api/workforce/attendance/monthly/reopen', { year, month, reason: values.reason }, 'Reopened');
        }}
        submitLabel="Reopen"
      />
    </div>
  );
}
