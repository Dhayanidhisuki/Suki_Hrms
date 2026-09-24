/**
 * Employee Self Service — Attendance. Self-service: always the logged-in
 * user's own daily attendance, resolved server-side. Read-only — an
 * employee raises corrections via Mis-Punch Requests, not here.
 *
 * The richer "Attendance Dashboard" layout (employee card, KPI tiles,
 * day-strip, Timeline view) is a reporting-manager-only enhancement —
 * a plain employee keeps the original simple table view below.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui';
import { handleExport } from '@/lib/export-utils';
import { fetchCurrentUser } from '@/lib/currentUser';

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

interface Profile {
  employeeCode: string;
  firstName: string;
  name: string;
  photoPath: string | null;
  email: string | null;
  mobile: string | null;
  designation: string | null;
  employeeType: string | null;
}

// ── Reporting-manager view ──────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string; fg: string }> = {
  Present:      { label: 'Present',   color: '#22c55e', bg: '#dcfce7', fg: '#166534' },
  HalfDay:      { label: 'Half Day',  color: '#ef4444', bg: '#fee2e2', fg: '#991b1b' },
  Late:         { label: 'Late',      color: '#f97316', bg: '#ffedd5', fg: '#9a3412' },
  Absent:       { label: 'Absent',    color: '#ef4444', bg: '#fee2e2', fg: '#991b1b' },
  LOP:          { label: 'LOP',       color: '#ef4444', bg: '#fee2e2', fg: '#991b1b' },
  Leave:        { label: 'Leave',     color: '#3b82f6', bg: '#dbeafe', fg: '#1e40af' },
  OnDuty:       { label: 'On Duty',   color: '#3b82f6', bg: '#dbeafe', fg: '#1e40af' },
  WeeklyOff:    { label: 'Weekend',   color: '#cbd5e1', bg: '#f1f5f9', fg: '#475569' },
  Holiday:      { label: 'Holiday',   color: '#ec4899', bg: '#fce7f3', fg: '#9d174d' },
  MissingPunch: { label: 'Missing',   color: '#f59e0b', bg: '#fef9c3', fg: '#854d0e' },
};
const LEGEND = ['Present', 'Late', 'HalfDay', 'Leave', 'Holiday', 'WeeklyOff'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function hm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function wallClock(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}

/** Hours since midnight (UTC wall clock), for placing bars on the axis. */
function hourOf(iso: string) {
  const d = new Date(iso);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

function StatusDot({ status, day, today }: { status: string | undefined; day: number; today: boolean }) {
  const meta = status ? STATUS_META[status] : undefined;
  const filled = !!meta && status !== 'WeeklyOff';
  return (
    <div className="flex w-9 shrink-0 flex-col items-center gap-1.5">
      <span className="text-[11px] font-semibold" style={{ color: today ? '#ef4444' : meta ? 'var(--foreground)' : 'var(--foreground-muted)' }}>
        {String(day).padStart(2, '0')}
      </span>
      <span
        title={meta?.label ?? 'No record'}
        className="flex h-6 w-6 items-center justify-center rounded-full"
        style={{
          backgroundColor: filled ? meta!.color : 'var(--bg-subtle, #e5e7eb)',
          border: today ? '2px solid #ef4444' : 'none',
        }}
      >
        {status === 'Present' && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        )}
        {(status === 'HalfDay' || status === 'Late') && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0 0 20z" /></svg>
        )}
      </span>
    </div>
  );
}

function ManagerAttendanceView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [days, setDays] = useState<DayRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'timeline' | 'timecard'>('timeline');
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
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
      toast.error(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [year, month, toast]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    fetch('/api/workforce/my-dashboard')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.profile) setProfile(j.profile); })
      .catch(() => {});
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<number, DayRow>();
    for (const d of days) map.set(new Date(d.date).getUTCDate(), d);
    return map;
  }, [days]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const otOf = (d: DayRow) => (d.otApprovalStatus === 'approved' ? (d.otMinutesApproved ?? 0) : d.otMinutesCalculated);

  function exportAttendanceData(format: 'csv' | 'excel' | 'pdf') {
    const exportData = days.map((d) => ({
      Date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }),
      Status: d.status,
      Shift: d.shiftMaster?.code ?? '—',
      'In Time': wallClock(d.inTime),
      'Out Time': wallClock(d.outTime),
      'Working Hrs': d.workingMinutes > 0 ? hm(d.workingMinutes) : '—',
      'Late (min)': d.lateMinutes > 0 ? d.lateMinutes : '—',
      'Early Out (min)': d.earlyOutMinutes > 0 ? d.earlyOutMinutes : '—',
      OT: hm(otOf(d)),
    }));
    handleExport({
      filename: `attendance_${year}-${String(month).padStart(2, '0')}`,
      data: exportData,
      format,
      title: `Attendance Report - ${MONTH_NAMES[month - 1]} ${year}`,
    });
  }

  const fg = { color: 'var(--foreground)' };
  const muted = { color: 'var(--foreground-muted)' };
  const control = 'rounded-full border px-3 py-1.5 text-xs font-medium outline-none';
  const controlStyle = { backgroundColor: 'var(--surface)', borderColor: 'var(--border)', ...fg };
  const initials = (profile?.name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

  const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  return (
    <div className="space-y-5">
      <div className="flex gap-6 border-b" style={{ borderColor: 'var(--border)' }}>
        <Link href="/ess/dashboard" className="pb-2 text-sm font-medium hover:opacity-80" style={muted}>← ESS Dashboard</Link>
        <span className="border-b-2 pb-2 text-sm font-semibold" style={{ borderColor: 'var(--info)', color: 'var(--info)' }}>Attendance Dashboard</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={fg}>My Attendance</h1>
          <p className="text-sm" style={muted}>Track your attendance and manage time effortlessly.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void fetchData()} title="Refresh" className="flex h-8 w-8 items-center justify-center rounded-full border" style={controlStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></svg>
          </button>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={control} style={controlStyle}>
            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={control} style={controlStyle}>
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Employee details + KPI tiles */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold" style={fg}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--info)' }} />
              Employee Details
            </h3>
            <div className="flex items-center gap-2">
              {(['csv', 'excel', 'pdf'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => exportAttendanceData(f)}
                  disabled={days.length === 0}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold uppercase text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--info)' }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-5">
            <div className="relative">
              {profile?.photoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photoPath} alt={profile.name} className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white" style={{ backgroundColor: 'var(--info)' }}>
                  {initials}
                </div>
              )}
              {profile?.employeeType && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: '#22c55e' }}>
                  {profile.employeeType}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold" style={fg}>{profile?.name ?? '—'}</div>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-[11px]" style={muted}>Role</div>
                  <div className="text-sm font-medium" style={fg}>{profile?.designation ?? '—'}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px]" style={muted}>Email Address</div>
                  <div className="truncate text-sm font-medium" style={fg}>{profile?.email ?? '—'}</div>
                </div>
                <div>
                  <div className="text-[11px]" style={muted}>Phone Number</div>
                  <div className="text-sm font-medium" style={fg}>{profile?.mobile ?? '—'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Attendance', value: summary ? Number(summary.presentDays) : 0, unit: 'days' },
            { label: 'Overtime', value: summary ? hm(summary.otMinutesTotal) : '—', unit: '' },
            { label: 'Paid Leave', value: summary ? Number(summary.leaveDays) : 0, unit: 'days' },
            { label: 'Unpaid Leave (LOP)', value: summary ? Number(summary.lopDays) : 0, unit: 'days' },
          ].map((k) => (
            <div key={k.label} className="card p-4">
              <div className="text-xs" style={muted}>{k.label}</div>
              <div className="mt-2 text-2xl font-bold" style={fg}>
                {k.value} {k.unit && <span className="text-xs font-normal" style={muted}>{k.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Day strip */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold" style={fg}>Attendance</h3>
          <div className="flex flex-wrap items-center gap-3">
            {LEGEND.map((s) => (
              <span key={s} className="flex items-center gap-1 text-[11px]" style={muted}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />
                {STATUS_META[s].label}
              </span>
            ))}
          </div>
        </div>
        <div className="scroll-thin mt-4 flex gap-1 overflow-x-auto pb-1">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
            <StatusDot key={day} day={day} status={byDay.get(day)?.status} today={isCurrentMonth && day === now.getDate()} />
          ))}
        </div>
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-bold" style={fg}>Attendance History</h3>
          <div className="inline-flex rounded-full border p-0.5" style={{ borderColor: 'var(--border)' }}>
            {(['timecard', 'timeline'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className="rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors"
                style={view === v ? { backgroundColor: 'var(--info)', color: '#fff' } : muted}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="p-6 text-sm" style={muted}>Loading…</p>
        ) : days.length === 0 ? (
          <p className="p-6 text-sm" style={muted}>No attendance records for this month.</p>
        ) : view === 'timeline' ? (
          <div className="p-5">
            <div className="grid grid-cols-[120px_1fr_110px] items-center gap-3 pb-2 text-[11px]" style={muted}>
              <span>Date</span>
              <div className="relative h-4">
                {HOURS.map((h) => (
                  <span key={h} className="absolute -translate-x-1/2" style={{ left: `${(h / 24) * 100}%` }}>
                    {h === 24 ? '12 am' : `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'am' : 'pm'}`}
                  </span>
                ))}
              </div>
              <span />
            </div>
            <div className="space-y-2">
              {days.map((d) => {
                const meta = STATUS_META[d.status] ?? { label: d.status, color: '#94a3b8', bg: '#f1f5f9', fg: '#475569' };
                const hasSpan = !!d.inTime && !!d.outTime;
                const start = d.inTime ? hourOf(d.inTime) : 0;
                let end = d.outTime ? hourOf(d.outTime) : start;
                if (hasSpan && end <= start) end = 24;
                const ot = otOf(d);
                const date = new Date(d.date);
                return (
                  <div key={d.id} className="grid grid-cols-[120px_1fr_110px] items-center gap-3 rounded-xl px-2 py-2" style={{ backgroundColor: 'var(--bg-subtle, rgba(0,0,0,0.02))' }}>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border px-1.5 py-0.5 text-[10px] font-semibold" style={{ borderColor: 'var(--border)', ...muted }}>
                        {date.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' })}
                      </span>
                      <span className="text-xs font-medium" style={fg}>
                        {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })}
                      </span>
                    </div>
                    <div className="relative h-10">
                      {hasSpan ? (
                        <div
                          className="absolute top-0 flex h-full min-w-[130px] flex-col justify-center rounded-lg border-l-4 px-2"
                          style={{ left: `${(start / 24) * 100}%`, width: `${((end - start) / 24) * 100}%`, borderColor: meta.color, backgroundColor: meta.bg }}
                        >
                          <span className="whitespace-nowrap text-[11px] font-semibold" style={{ color: meta.fg }}>
                            {wallClock(d.inTime)} - {wallClock(d.outTime)}
                          </span>
                          <span className="whitespace-nowrap text-[10px]" style={{ color: meta.fg }}>
                            Work: {hm(d.workingMinutes)}{d.lateMinutes > 0 ? ` · Late ${d.lateMinutes}m` : ''}
                          </span>
                        </div>
                      ) : (
                        <div className="flex h-full items-center">
                          <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: meta.bg, color: meta.fg }}>
                            {meta.label}{d.inTime && !d.outTime ? ` · In ${wallClock(d.inTime)}` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {ot > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                          Overtime {hm(ot)}
                        </span>
                      ) : d.earlyOutMinutes > 0 ? (
                        <span className="rounded-full px-2 py-1 text-[11px] font-medium" style={{ backgroundColor: '#ffedd5', color: '#9a3412' }}>Early {d.earlyOutMinutes}m</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b text-left text-xs font-semibold uppercase tracking-wide" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)', ...muted }}>
                  {['Date', 'Status', 'Shift', 'In', 'Out', 'Working Hrs', 'Late', 'Early Out', 'OT'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {days.map((d, i) => {
                  const meta = STATUS_META[d.status] ?? { label: d.status, color: '#94a3b8', bg: '#f1f5f9', fg: '#475569' };
                  const ot = otOf(d);
                  return (
                    <tr key={d.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)', backgroundColor: i % 2 === 1 ? 'var(--bg-subtle, rgba(0,0,0,0.015))' : 'transparent' }}>
                      <td className="px-4 py-2.5" style={fg}>{new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short', timeZone: 'UTC' })}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: meta.bg, color: meta.fg }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5" style={muted}>{d.shiftMaster?.code ?? '—'}</td>
                      <td className="px-4 py-2.5" style={fg}>{wallClock(d.inTime)}</td>
                      <td className="px-4 py-2.5" style={fg}>{wallClock(d.outTime)}</td>
                      <td className="px-4 py-2.5" style={fg}>{d.workingMinutes > 0 ? hm(d.workingMinutes) : '—'}</td>
                      <td className="px-4 py-2.5" style={{ color: d.lateMinutes > 0 ? '#991b1b' : 'var(--foreground-muted)' }}>{d.lateMinutes > 0 ? `${d.lateMinutes}m` : '—'}</td>
                      <td className="px-4 py-2.5" style={{ color: d.earlyOutMinutes > 0 ? '#991b1b' : 'var(--foreground-muted)' }}>{d.earlyOutMinutes > 0 ? `${d.earlyOutMinutes}m` : '—'}</td>
                      <td className="px-4 py-2.5" style={fg}>{ot > 0 ? hm(ot) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Plain employee view (original) ──────────────────────────────────────────

const LEGACY_STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  Present: { bg: '#dcfce7', fg: '#166534' },
  Absent: { bg: '#fee2e2', fg: '#991b1b' },
  WeeklyOff: { bg: '#f1f5f9', fg: '#475569' },
  Holiday: { bg: '#e0e7ff', fg: '#3730a3' },
  HalfDay: { bg: '#fef9c3', fg: '#854d0e' },
  LOP: { bg: '#fee2e2', fg: '#991b1b' },
  OnDuty: { bg: '#dbeafe', fg: '#1e40af' },
  MissingPunch: { bg: '#fef9c3', fg: '#854d0e' },
};

function LegacyAttendanceView() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [days, setDays] = useState<DayRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
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
      toast.error(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [year, month, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function exportAttendanceData(format: 'csv' | 'excel' | 'pdf') {
    const exportData = days.map(d => ({
      Date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }),
      Status: d.status,
      Shift: d.shiftMaster?.code ?? '—',
      'In Time': d.inTime ? wallClock(d.inTime) : '—',
      'Out Time': d.outTime ? wallClock(d.outTime) : '—',
      'Working Hrs': d.workingMinutes > 0 ? hm(d.workingMinutes) : '—',
      'Late (min)': d.lateMinutes > 0 ? d.lateMinutes : '—',
      'Early Out (min)': d.earlyOutMinutes > 0 ? d.earlyOutMinutes : '—',
      'OT': d.otApprovalStatus === 'approved' ? hm(d.otMinutesApproved ?? 0) : hm(d.otMinutesCalculated),
    }));

    handleExport({
      filename: `attendance_${year}-${String(month).padStart(2, '0')}`,
      data: exportData,
      format,
      title: `Attendance Report - ${new Date(2024, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}`,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>My Attendance</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportAttendanceData('csv')}
            disabled={days.length === 0}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary, #2563eb)' }}
            title="Download as CSV"
          >
            CSV
          </button>
          <button
            onClick={() => exportAttendanceData('excel')}
            disabled={days.length === 0}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary, #2563eb)' }}
            title="Download as Excel"
          >
            Excel
          </button>
          <button
            onClick={() => exportAttendanceData('pdf')}
            disabled={days.length === 0}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary, #2563eb)' }}
            title="Download as PDF"
          >
            PDF
          </button>
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
                  const tone = LEGACY_STATUS_TONE[d.status] ?? { bg: '#f1f5f9', fg: '#475569' };
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

// ── Entry point ──────────────────────────────────────────────────────────────

export default function EssAttendancePage() {
  const [isManager, setIsManager] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser().then((me) => { if (!cancelled) setIsManager(!!me?.isManager); });
    return () => { cancelled = true; };
  }, []);

  if (isManager === null) return <div className="p-6 text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>;
  return isManager ? <ManagerAttendanceView /> : <LegacyAttendanceView />;
}
