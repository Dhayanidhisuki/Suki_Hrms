/**
 * Attendance Overview — one employee, one month, day by day (the per-person
 * view the Monthly Attendance grid drills into). Modelled on the client's
 * reference screen: a date × (in / out / late / early / shift / pre-ET /
 * post-ET / ET / payable ET / total / status) table with a summary panel
 * underneath. Read-only; corrections still happen on Daily Attendance,
 * which the pencil on each row links to.
 *
 * Data comes from /api/workforce/attendance/overview, which returns every
 * calendar day of the month whether or not a DailyAttendance row exists.
 */

'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchableSelect } from '@/components/ui';

interface EmployeeOption {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
}

interface DayRow {
  date: string;
  day: number;
  weekday: string;
  status: string;
  storedStatus: string | null;
  inferredWeeklyOff: boolean;
  inTime: string | null;
  outTime: string | null;
  punchPairInvalid: boolean;
  shiftName: string | null;
  shiftMinutes: number;
  shiftStartMinutes: number | null;
  workingMinutes: number;
  lateMinutes: number;
  earlyOutMinutes: number;
  preExtraMinutes: number;
  postExtraMinutes: number;
  otMinutesCalculated: number;
  otMinutesApproved: number | null;
  otApprovalStatus: string | null;
  source: string | null;
  remarks: string | null;
}

interface Summary {
  totalDays: number;
  presentDays: number;
  weeklyOffDays: number;
  holidayDays: number;
  leaveDays: number;
  absentDays: number;
  lopDays: number;
  onDutyDays: number;
  halfDays: number;
  permissionDays: number;
  missingPunchDays: number;
  invalidPunchPairDays: number;
  paidDays: number;
  lateComeCount: number;
  lateComeMinutes: number;
  earlyGoCount: number;
  earlyGoMinutes: number;
  preExtraMinutes: number;
  postExtraMinutes: number;
  otCalculatedMinutes: number;
  otApprovedMinutes: number;
  otPendingCount: number;
  otRejectedCount: number;
  shiftMinutes: number;
  workingMinutes: number;
  expectedWorkingMinutes: number;
  biometricDays: number;
  manualDays: number;
}

interface OverviewResponse {
  employee: {
    id: number;
    employeeCode: string;
    name: string;
    department: string | null;
    designation: string | null;
    shiftAssignmentType: string;
    shiftLabel: string;
  };
  year: number;
  month: number;
  monthStatus: 'OPEN' | 'FINALIZED' | 'FROZEN';
  days: DayRow[];
  summary: Summary;
}

// Punches are stored as neutral wall-clock values via setUTCHours — read
// back with the UTC getters, never the local ones (same rule as the other
// attendance pages).
function wallClock(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** 554 → "9:14"; 0 → "0:00". */
function hm(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

/** Cell for a minute count that is usually zero — blank-ish when zero so the eye lands on the exceptions. */
function minutesCell(minutes: number) {
  return minutes > 0 ? hm(minutes) : <span style={{ color: 'var(--foreground-muted)' }}>0</span>;
}

const STATUS_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  Present: { label: 'Present', bg: '#dcfce7', fg: '#166534' },
  OnDuty: { label: 'On Duty', bg: '#dcfce7', fg: '#166534' },
  HalfDay: { label: 'Half Day', bg: '#fef9c3', fg: '#854d0e' },
  Permission: { label: 'Permission', bg: '#fef3c7', fg: '#92400e' },
  WeeklyOff: { label: 'Weekly Off', bg: '#dbeafe', fg: '#1e40af' },
  Holiday: { label: 'Holiday', bg: '#dbeafe', fg: '#1e40af' },
  Leave: { label: 'Leave', bg: '#ede9fe', fg: '#5b21b6' },
  Absent: { label: 'Absent', bg: '#fee2e2', fg: '#991b1b' },
  LOP: { label: 'LOP', bg: '#fee2e2', fg: '#991b1b' },
  MissingPunch: { label: 'Missing Punch', bg: '#ffedd5', fg: '#9a3412' },
  NoRecord: { label: 'No Record', bg: 'transparent', fg: '#9ca3af' },
  Upcoming: { label: '', bg: 'transparent', fg: '#9ca3af' },
};

function StatusPill({ row }: { row: DayRow }) {
  const s = STATUS_STYLE[row.status] ?? { label: row.status, bg: '#e5e7eb', fg: '#374151' };
  if (!s.label) return null;
  const title = row.inferredWeeklyOff
    ? `Shown as Weekly Off: Sunday with no punches (stored as ${row.storedStatus ?? 'no record'})`
    : row.remarks ?? undefined;
  return (
    <span
      title={title}
      className="inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: s.bg, color: s.fg, border: s.bg === 'transparent' ? '1px dashed #d1d5db' : undefined }}
    >
      {s.label}
      {row.inferredWeeklyOff ? ' *' : ''}
    </span>
  );
}

function rowTint(status: string): string | undefined {
  if (status === 'WeeklyOff' || status === 'Holiday') return 'rgba(59,130,246,0.06)';
  if (status === 'Leave') return 'rgba(139,92,246,0.06)';
  if (status === 'Absent' || status === 'LOP') return 'rgba(239,68,68,0.06)';
  if (status === 'MissingPunch') return 'rgba(249,115,22,0.06)';
  return undefined;
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
      <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>
        {label}
      </div>
      <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
        {value}
      </div>
      {sub ? (
        <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function SummaryList({ title, rows }: { title: string; rows: [string, string | number][] }) {
  return (
    <div className="rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
      <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
        {title}
      </div>
      <dl className="divide-y text-sm" style={{ borderColor: 'var(--border)' }}>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between px-3 py-1.5" style={{ borderColor: 'var(--border)' }}>
            <dt style={{ color: 'var(--foreground-muted)' }}>{k}</dt>
            <dd className="font-medium tabular-nums" style={{ color: 'var(--foreground)' }}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const now = new Date();

function OverviewInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The URL is the single source of truth for the selection, so the page is
  // linkable from the Monthly grid, survives a hard reload, and needs no
  // state/URL synchronisation effect (which would also refetch on every sync).
  const employeeId: number | '' = Number(params.get('employeeId')) || '';
  const year = Number(params.get('year')) || now.getFullYear();
  const month = Number(params.get('month')) || now.getMonth() + 1;

  const updateSelection = useCallback(
    (patch: { employeeId?: number | ''; year?: number; month?: number }) => {
      const next = { employeeId, year, month, ...patch };
      const q = new URLSearchParams();
      if (next.employeeId) q.set('employeeId', String(next.employeeId));
      q.set('year', String(next.year));
      q.set('month', String(next.month));
      router.replace(`/workforce/attendance/overview?${q.toString()}`);
    },
    [employeeId, year, month, router]
  );
  const setEmployeeId = (v: number | '') => updateSelection({ employeeId: v });
  const setYear = (v: number) => updateSelection({ year: v });
  const setMonth = (v: number) => updateSelection({ month: v });

  useEffect(() => {
    fetch('/api/employees?limit=500')
      .then((r) => r.json())
      .then((json: { data: EmployeeOption[] }) => {
        const list = (json.data ?? []).slice().sort((a, b) => a.employeeCode.localeCompare(b.employeeCode, undefined, { numeric: true }));
        setEmployees(list);
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!employeeId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workforce/attendance/overview?employeeId=${employeeId}&year=${year}&month=${month}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to fetch');
      setData(json as OverviewResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId, year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const employeeOptions = useMemo(
    () => employees.map((e) => ({ label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`.trim(), value: e.id })),
    [employees]
  );

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    updateSelection({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };

  const monthLabel = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  const s = data?.summary;
  const anyInferred = data?.days.some((d) => d.inferredWeeklyOff) ?? false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Attendance Overview
          </h1>
          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            One employee, one month, day by day.{' '}
            <Link href={`/workforce/attendance/monthly`} className="underline">
              Back to monthly grid
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-72">
            <SearchableSelect
              value={employeeId}
              options={employeeOptions}
              onChange={(v) => setEmployeeId(v === '' ? '' : Number(v))}
              placeholder="Select employee…"
            />
          </div>
          <button
            onClick={() => shiftMonth(-1)}
            className="rounded-lg border px-2 py-2 text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)', backgroundColor: 'var(--surface)' }}
            aria-label="Previous month"
          >
            ‹
          </button>
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
          <button
            onClick={() => shiftMonth(1)}
            className="rounded-lg border px-2 py-2 text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)', backgroundColor: 'var(--surface)' }}
            aria-label="Next month"
          >
            ›
          </button>
          {data && (
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: data.monthStatus === 'FROZEN' ? '#fee2e2' : data.monthStatus === 'FINALIZED' ? '#fef9c3' : '#dcfce7',
                color: data.monthStatus === 'FROZEN' ? '#991b1b' : data.monthStatus === 'FINALIZED' ? '#854d0e' : '#166534',
              }}
            >
              {data.monthStatus === 'FROZEN' ? '🔒 Frozen' : data.monthStatus}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {!employeeId && !loading && (
        <div className="rounded-lg border px-4 py-10 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)', backgroundColor: 'var(--surface)' }}>
          Pick an employee to see their {monthLabel} attendance.
        </div>
      )}

      {data && s && (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <div>
              <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                {data.employee.name}
              </span>{' '}
              <span style={{ color: 'var(--foreground-muted)' }}>({data.employee.employeeCode})</span>
            </div>
            <div style={{ color: 'var(--foreground-muted)' }}>
              {[data.employee.department, data.employee.designation].filter(Boolean).join(' · ') || '—'}
            </div>
            <div style={{ color: 'var(--foreground-muted)' }}>
              Shift: <span style={{ color: 'var(--foreground)' }}>{data.employee.shiftLabel}</span>
              {data.employee.shiftAssignmentType === 'ROTATIONAL' ? ' (rotational)' : ''}
            </div>
            <div className="ml-auto font-medium" style={{ color: 'var(--foreground)' }}>
              {monthLabel}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Present" value={s.presentDays} sub={`of ${s.totalDays} days`} />
            <Stat label="Paid days" value={s.paidDays} sub={`WO ${s.weeklyOffDays} · Hol ${s.holidayDays} · Leave ${s.leaveDays}`} />
            <Stat label="Absent / LOP" value={`${s.absentDays} / ${s.lopDays}`} />
            <Stat label="Late come" value={s.lateComeCount} sub={`${hm(s.lateComeMinutes)} h total`} />
            <Stat label="Working time" value={`${hm(s.workingMinutes)} h`} sub={`expected ${hm(s.expectedWorkingMinutes)} h`} />
            <Stat label="Approved OT" value={`${hm(s.otApprovedMinutes)} h`} sub={`system ${hm(s.otCalculatedMinutes)} h`} />
          </div>

          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--foreground-muted)' }}>
                  {['#', 'Date', 'Day', 'In', 'Out', 'Late', 'Early', 'Shift', 'Shift hrs', 'Pre ET', 'Post ET', 'ET', 'Payable ET', 'Total', 'Status', 'Src', ''].map((h, i) => (
                    <th
                      key={h || i}
                      className={`whitespace-nowrap px-2 py-2 font-medium ${i >= 3 && i <= 13 ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={17} className="px-4 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
                      Loading...
                    </td>
                  </tr>
                ) : (
                  data.days.map((d) => {
                    const upcoming = d.status === 'Upcoming';
                    const payable = d.otMinutesApproved ?? 0;
                    return (
                      <tr
                        key={d.date}
                        style={{ borderTop: '1px solid var(--border)', backgroundColor: rowTint(d.status), color: 'var(--foreground)', opacity: upcoming ? 0.45 : 1 }}
                      >
                        <td className="px-2 py-1.5 tabular-nums" style={{ color: 'var(--foreground-muted)' }}>
                          {d.day}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{d.date.split('-').reverse().join('-')}</td>
                        <td className="px-2 py-1.5" style={{ color: d.weekday === 'Sunday' ? '#1e40af' : undefined }}>
                          {d.weekday}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{wallClock(d.inTime)}</td>
                        <td
                          className="px-2 py-1.5 text-right tabular-nums"
                          title={d.punchPairInvalid ? 'Out-punch is earlier than in-punch — check this day' : undefined}
                          style={{ color: d.punchPairInvalid ? '#b91c1c' : undefined }}
                        >
                          {wallClock(d.outTime)}
                          {d.punchPairInvalid ? ' ⚠' : ''}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: d.lateMinutes > 0 ? '#b45309' : undefined }}>
                          {minutesCell(d.lateMinutes)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: d.earlyOutMinutes > 0 ? '#b45309' : undefined }}>
                          {minutesCell(d.earlyOutMinutes)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5" style={{ color: 'var(--foreground-muted)' }}>
                          {d.shiftName ?? '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{d.shiftMinutes ? hm(d.shiftMinutes) : <span style={{ color: 'var(--foreground-muted)' }}>0:00</span>}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{minutesCell(d.preExtraMinutes)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{minutesCell(d.postExtraMinutes)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums" title={d.otApprovalStatus ? `OT ${d.otApprovalStatus}` : undefined}>
                          {minutesCell(d.otMinutesCalculated)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: payable > 0 ? '#166534' : undefined }}>
                          {minutesCell(payable)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                          {d.workingMinutes > 0 ? hm(d.workingMinutes) : <span style={{ color: 'var(--foreground-muted)' }}>0:00</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          <StatusPill row={d} />
                        </td>
                        <td className="px-2 py-1.5" title={d.source ?? undefined} style={{ color: 'var(--foreground-muted)' }}>
                          {d.source === 'biometric' ? 'B' : d.source === 'manual' ? 'M' : ''}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {!upcoming && (
                            <Link
                              href={`/workforce/attendance/daily?date=${d.date}`}
                              title={data.monthStatus === 'FROZEN' ? 'Month is frozen — view only' : 'Open in Daily Attendance'}
                              className="text-sm"
                              style={{ color: data.monthStatus === 'FROZEN' ? '#9ca3af' : 'var(--accent)' }}
                            >
                              {data.monthStatus === 'FROZEN' ? '🔒' : '✎'}
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {anyInferred && (
            <p className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
              * Sundays without punches are shown as Weekly Off. The stored status is kept unchanged and visible on hover; this display rule goes away once the weekly-off master is confirmed.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryList
              title="Attendance"
              rows={[
                ['Present', s.presentDays],
                ['Half day', s.halfDays],
                ['On duty', s.onDutyDays],
                ['Permission', s.permissionDays],
                ['Weekly off', s.weeklyOffDays],
                ['Holiday', s.holidayDays],
                ['Leave', s.leaveDays],
                ['Absent', s.absentDays],
                ['LOP', s.lopDays],
                ['Missing punch', s.missingPunchDays],
                ['Out before in ⚠', s.invalidPunchPairDays],
              ]}
            />
            <SummaryList
              title="Days"
              rows={[
                ['Total days', s.totalDays],
                ['Paid days', s.paidDays],
                ['LOP days', s.lopDays],
                ['Biometric days', s.biometricDays],
                ['Manual days', s.manualDays],
                ['Month status', data.monthStatus],
              ]}
            />
            <SummaryList
              title="Timing"
              rows={[
                ['Late come', `${s.lateComeCount} / ${hm(s.lateComeMinutes)}`],
                ['Early go', `${s.earlyGoCount} / ${hm(s.earlyGoMinutes)}`],
                ['Shift time', hm(s.shiftMinutes)],
                ['Working time', hm(s.workingMinutes)],
                ['Expected working hours', hm(s.expectedWorkingMinutes)],
                ['Difference', hm(s.workingMinutes - s.expectedWorkingMinutes)],
              ]}
            />
            <SummaryList
              title="Extra time"
              rows={[
                ['Pre extra time', hm(s.preExtraMinutes)],
                ['Post extra time', hm(s.postExtraMinutes)],
                ['Pre + post', hm(s.preExtraMinutes + s.postExtraMinutes)],
                ['System OT', hm(s.otCalculatedMinutes)],
                ['Approved OT', hm(s.otApprovedMinutes)],
                ['Pending / rejected', `${s.otPendingCount} / ${s.otRejectedCount}`],
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function AttendanceOverviewPage() {
  // useSearchParams needs a Suspense boundary for static prerendering.
  return (
    <Suspense fallback={null}>
      <OverviewInner />
    </Suspense>
  );
}
