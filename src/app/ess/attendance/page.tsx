/**
 * Employee Self Service — Attendance. Self-service: always the logged-in
 * user's own daily attendance, resolved server-side. Read-only — an
 * employee raises corrections via Mis-Punch Requests, not here.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface DayRow {
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
  otApprovalStatus: string | null;
  shiftMaster: { code: string; name: string } | null;
}

interface Summary {
  totalWorkingDays: number;
  payableDays: string;
  presentDays: string;
  absentDays: string;
  leaveDays: string;
  lopDays: string;
  otMinutesTotal: number;
  lateMinutesTotal: number;
  earlyOutMinutesTotal: number;
  status: string;
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  Present: { bg: '#dcfce7', fg: '#166534' },
  Absent: { bg: '#fee2e2', fg: '#991b1b' },
  WeeklyOff: { bg: '#f1f5f9', fg: '#475569' },
  Holiday: { bg: '#e0e7ff', fg: '#3730a3' },
  HalfDay: { bg: '#fef9c3', fg: '#854d0e' },
  LOP: { bg: '#fee2e2', fg: '#991b1b' },
  OnDuty: { bg: '#dbeafe', fg: '#1e40af' },
  MissingPunch: { bg: '#fef9c3', fg: '#854d0e' },
};

function hm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function wallClock(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}

export default function EssAttendancePage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [days, setDays] = useState<DayRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workforce/my-attendance?year=${year}&month=${month}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load attendance');
      }
      const json = await res.json();
      setDays(json.data ?? []);
      setSummary(json.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>My Attendance</h1>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          />
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : (
        <>
          {summary && (
            <div className="grid grid-cols-6 gap-3">
              <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Present</div>
                <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{summary.presentDays}</div>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Absent</div>
                <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{summary.absentDays}</div>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Leave</div>
                <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{summary.leaveDays}</div>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>LOP</div>
                <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{summary.lopDays}</div>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Late</div>
                <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{hm(summary.lateMinutesTotal)}</div>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>OT</div>
                <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{hm(summary.otMinutesTotal)}</div>
              </div>
            </div>
          )}

          <div className="rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Shift</th>
                  <th className="px-4 py-2">In</th>
                  <th className="px-4 py-2">Out</th>
                  <th className="px-4 py-2">Working Hrs</th>
                  <th className="px-4 py-2">Late</th>
                  <th className="px-4 py-2">Early Out</th>
                  <th className="px-4 py-2">OT</th>
                </tr>
              </thead>
              <tbody>
                {days.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-6 text-center" style={{ color: 'var(--foreground-muted)' }}>No attendance records for this month.</td></tr>
                )}
                {days.map((d) => {
                  const tone = STATUS_TONE[d.status] ?? { bg: '#f1f5f9', fg: '#475569' };
                  const otMinutes = d.otApprovalStatus === 'approved' ? (d.otMinutesApproved ?? 0) : d.otMinutesCalculated;
                  return (
                    <tr key={d.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-4 py-2">{new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short', timeZone: 'UTC' })}</td>
                      <td className="px-4 py-2">
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>{d.status}</span>
                      </td>
                      <td className="px-4 py-2" style={{ color: 'var(--foreground-muted)' }}>{d.shiftMaster?.code ?? '—'}</td>
                      <td className="px-4 py-2">{wallClock(d.inTime)}</td>
                      <td className="px-4 py-2">{wallClock(d.outTime)}</td>
                      <td className="px-4 py-2">{d.workingMinutes > 0 ? hm(d.workingMinutes) : '—'}</td>
                      <td className="px-4 py-2" style={{ color: d.lateMinutes > 0 ? '#991b1b' : 'var(--foreground-muted)' }}>{d.lateMinutes > 0 ? `${d.lateMinutes}m` : '—'}</td>
                      <td className="px-4 py-2" style={{ color: d.earlyOutMinutes > 0 ? '#991b1b' : 'var(--foreground-muted)' }}>{d.earlyOutMinutes > 0 ? `${d.earlyOutMinutes}m` : '—'}</td>
                      <td className="px-4 py-2">{otMinutes > 0 ? hm(otMinutes) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
