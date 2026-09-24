/**
 * Employee Self Service — My Attendance. Self-service: always the
 * logged-in user's own daily attendance, resolved server-side. Read-only —
 * an employee raises corrections via Mis-Punch Requests, not here.
 *
 * Two independent toggles:
 *   - period: Monthly (one month, day-level) | Yearly (all 12 months,
 *     one rollup row each — a 365-row day table would be unusable).
 *   - view: Calendar | Table — only meaningful in Monthly; Yearly only
 *     ever renders as a table, since there is no sensible "calendar of a
 *     whole year."
 *
 * Two overlays in Monthly are derived from other self-service data the day
 * row alone can't tell you:
 *   - WFH: an approved WFH request marks the day 'Present' on
 *     DailyAttendance (WFH is not one of the client-confirmed attendance
 *     statuses — see the WfhRequest model), so it is indistinguishable from
 *     an ordinary present day unless cross-referenced against approved WFH
 *     date ranges.
 *   - "Leave Request Pending": a day with no DailyAttendance row yet because
 *     nothing has been decided — shown when a pending LeaveApplication
 *     covers that date, so the employee sees it's in flight, not just blank.
 * Yearly skips these two overlays and the day×day fetches they need — it
 * only pulls each month's aggregate summary, not 365 individual days.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui';
import { handleExport } from '@/lib/export-utils';
import { ChevronLeft, ChevronRight, CheckCircle2, AlarmClockOff, Palmtree, Frown, Download, CalendarDays, Table2 } from 'lucide-react';

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
  lomApprovalStatus: string | null;
  lomApprovedMinutes: number | null;
  shiftMaster: { code: string; name: string } | null;
}

interface PermissionRow {
  date: string;
  hours: number;
  status: string;
}

interface MonthSummary {
  totalWorkingDays: number;
  payableDays: string;
  presentDays: string;
  absentDays: string;
  leaveDays: string;
  lopDays: string;
  otMinutesTotal: number;
  lateMinutesTotal: number;
  earlyOutMinutesTotal: number;
}

interface WfhRow {
  fromDate: string;
  toDate: string;
  status: string;
}

interface LeaveAppRow {
  fromDate: string;
  toDate: string;
  status: string;
}

interface DayMeta {
  label: string;
  bg: string;
  fg: string;
}

const STATUS_META: Record<string, DayMeta> = {
  Present: { label: 'Present', bg: 'var(--success-soft)', fg: 'var(--success)' },
  Absent: { label: 'Absent', bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  WeeklyOff: { label: 'Week Off', bg: 'var(--bg-subtle)', fg: 'var(--text-muted)' },
  Holiday: { label: 'Holiday', bg: 'var(--info-soft)', fg: 'var(--info)' },
  HalfDay: { label: 'Half Day', bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  LOP: { label: 'LOP', bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  OnDuty: { label: 'On Duty', bg: 'var(--info-soft)', fg: 'var(--info)' },
  MissingPunch: { label: 'Missing Punch', bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  Leave: { label: 'Leave (Approved)', bg: 'var(--warning-soft)', fg: 'var(--warning)' },
};
const WFH_META: DayMeta = { label: 'WFH (Work From Home)', bg: 'var(--accent-soft, var(--info-soft))', fg: 'var(--accent, var(--info))' };
const PENDING_LEAVE_META: DayMeta = { label: 'Leave Request Pending', bg: 'var(--danger-soft)', fg: 'var(--danger)' };

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function hm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function wallClock(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}

/**
 * Late/on-time counts — punch-based (did this day have a late-marked
 * check-in?), not tied to day status. Deliberately NOT derived the same way
 * as Present/Leave/Absent below: those are fractional in the server's own
 * summary (a HalfDay counts as 0.5 present + 0.5 absent there), and mixing a
 * fractional day-count with an integer late/on-time count would be a
 * category error. Late/on-time are simple whole-day punch facts regardless
 * of what the day's overall status ended up being.
 */
function computePunchCounts(days: DayRow[]) {
  const late = days.filter((d) => d.lateMinutes > 0).length;
  const onTime = days.filter((d) => d.inTime && d.lateMinutes === 0).length;
  return { late, onTime };
}

/** true if `dateStr` (YYYY-MM-DD) falls within [fromDate, toDate] of any row. */
function coversDate(ranges: { fromDate: string; toDate: string }[], dateStr: string): boolean {
  return ranges.some((r) => dateStr >= r.fromDate.slice(0, 10) && dateStr <= r.toDate.slice(0, 10));
}

const LOM_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

/**
 * LOM (Loss of Minutes) has no stored "raw" figure of its own — it is
 * derived from late + early-out minutes (same formula attendanceHistory.ts
 * uses to auto-queue it), with `lomApprovedMinutes` overriding once HR has
 * actually decided the deduction. Null when there is nothing to show.
 */
function lomDisplay(d: DayRow): string | null {
  const raw = d.lateMinutes + d.earlyOutMinutes;
  if (raw === 0) return null;
  const minutes = d.lomApprovalStatus === 'approved' ? d.lomApprovedMinutes ?? raw : raw;
  const statusLabel = d.lomApprovalStatus ? LOM_STATUS_LABEL[d.lomApprovalStatus] ?? d.lomApprovalStatus : null;
  return statusLabel ? `${minutes}m (${statusLabel})` : `${minutes}m`;
}

const PERMISSION_STATUS_LABEL: Record<string, string> = {
  pending_manager: 'Pending',
  pending_hr: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

/** A day can only ever have the permission request(s) actually raised
 * against that exact date — matched here rather than carried on DailyAttendance,
 * since an approved permission never writes back to the attendance row (it
 * only shortens the day, tracked entirely in PermissionRequest). */
function permissionDisplay(dateStr: string, permissions: PermissionRow[]): string | null {
  const matches = permissions.filter((p) => p.date.slice(0, 10) === dateStr);
  if (matches.length === 0) return null;
  const hours = matches.reduce((sum, p) => sum + Number(p.hours), 0);
  const statuses = new Set(matches.map((p) => PERMISSION_STATUS_LABEL[p.status] ?? p.status));
  return `${hours}h (${Array.from(statuses).join(', ')})`;
}

/** Same resolution the calendar cells and the day-level table both use, so
 * the two views can never disagree about what a given day was. */
function resolveDayMeta(dateStr: string, row: DayRow | undefined, wfhRanges: WfhRow[], pendingLeave: LeaveAppRow[]): DayMeta | null {
  if (row) {
    if (row.status === 'Present' && coversDate(wfhRanges, dateStr)) return WFH_META;
    return STATUS_META[row.status] ?? { label: row.status, bg: 'var(--bg-subtle)', fg: 'var(--text-muted)' };
  }
  if (coversDate(pendingLeave, dateStr)) return PENDING_LEAVE_META;
  return null;
}

type Period = 'monthly' | 'yearly';
type ViewMode = 'calendar' | 'table';

export default function EssAttendancePage() {
  const now = new Date();
  const [period, setPeriod] = useState<Period>('monthly');
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // Monthly period data
  const [days, setDays] = useState<DayRow[]>([]);
  const [monthSummary, setMonthSummary] = useState<MonthSummary | null>(null);
  const [wfhRanges, setWfhRanges] = useState<WfhRow[]>([]);
  const [pendingLeave, setPendingLeave] = useState<LeaveAppRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);

  // Yearly period data — one summary + day-list per month, so the KPI row
  // can still be computed the same way (over all days concatenated).
  const [yearMonths, setYearMonths] = useState<{ month: number; days: DayRow[]; summary: MonthSummary | null }[]>([]);

  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchMonthly = useCallback(async () => {
    const [curRes, wfhRes, leaveRes, permRes] = await Promise.all([
      fetch(`/api/workforce/my-attendance?year=${year}&month=${month}`),
      fetch('/api/workforce/wfh?scope=mine'),
      fetch(`/api/workforce/my-leave?year=${year}`),
      fetch('/api/workforce/permission?scope=mine'),
    ]);
    if (!curRes.ok) {
      const j = await curRes.json().catch(() => ({}));
      throw new Error(j.error ?? 'Failed to load attendance');
    }
    const curJson = await curRes.json();
    setDays(curJson.data ?? []);
    setMonthSummary(curJson.summary ?? null);

    if (wfhRes.ok) {
      const wfhJson: { data: WfhRow[] } = await wfhRes.json();
      setWfhRanges((wfhJson.data ?? []).filter((r) => r.status === 'approved'));
    } else {
      setWfhRanges([]);
    }

    if (leaveRes.ok) {
      const leaveJson: { applications: LeaveAppRow[] } = await leaveRes.json();
      setPendingLeave((leaveJson.applications ?? []).filter((r) => ['pending_manager', 'pending_hr'].includes(r.status)));
    } else {
      setPendingLeave([]);
    }

    // ?scope=mine returns the caller's whole history, not just this month —
    // the LOM/Permission table columns filter it down to the visible dates.
    if (permRes.ok) {
      const permJson: { data: PermissionRow[] } = await permRes.json();
      setPermissions(permJson.data ?? []);
    } else {
      setPermissions([]);
    }
  }, [year, month]);

  const fetchYearly = useCallback(async () => {
    // One call per month rather than a single 365-row endpoint — reuses the
    // exact same API the monthly view already calls, so the two periods can
    // never disagree about what a given month's numbers were. WFH/pending-
    // leave overlays are skipped here: the yearly table shows aggregate
    // counts per month, not per-day status, so there's nothing to overlay.
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => i + 1).map(async (m) => {
        const res = await fetch(`/api/workforce/my-attendance?year=${year}&month=${m}`);
        if (!res.ok) return { month: m, days: [] as DayRow[], summary: null as MonthSummary | null };
        const json = await res.json();
        return { month: m, days: (json.data ?? []) as DayRow[], summary: (json.summary ?? null) as MonthSummary | null };
      })
    );
    setYearMonths(results);
  }, [year]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (period === 'monthly') await fetchMonthly();
      else await fetchYearly();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [period, fetchMonthly, fetchYearly, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function exportAttendanceData(format: 'csv' | 'excel' | 'pdf') {
    if (period === 'monthly') {
      const exportData = days.map((d) => ({
        Date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }),
        Status: d.status,
        Shift: d.shiftMaster?.code ?? '—',
        'In Time': d.inTime ? wallClock(d.inTime) : '—',
        'Out Time': d.outTime ? wallClock(d.outTime) : '—',
        'Working Hrs': d.workingMinutes > 0 ? hm(d.workingMinutes) : '—',
        'Late (min)': d.lateMinutes > 0 ? d.lateMinutes : '—',
        'Early Out (min)': d.earlyOutMinutes > 0 ? d.earlyOutMinutes : '—',
        OT: d.otApprovalStatus === 'approved' ? hm(d.otMinutesApproved ?? 0) : hm(d.otMinutesCalculated),
        LOM: lomDisplay(d) ?? '—',
        Permission: permissionDisplay(d.date.slice(0, 10), permissions) ?? '—',
      }));
      handleExport({
        filename: `attendance_${year}-${String(month).padStart(2, '0')}`,
        data: exportData,
        format,
        title: `Attendance Report - ${MONTH_NAMES[month - 1]} ${year}`,
      });
    } else {
      const exportData = yearMonths.map((ym) => ({
        Month: MONTH_NAMES[ym.month - 1],
        Present: ym.summary?.presentDays ?? '—',
        Absent: ym.summary?.absentDays ?? '—',
        Leave: ym.summary?.leaveDays ?? '—',
        LOP: ym.summary?.lopDays ?? '—',
        'Late (total)': ym.summary ? hm(ym.summary.lateMinutesTotal) : '—',
        'OT (total)': ym.summary ? hm(ym.summary.otMinutesTotal) : '—',
      }));
      handleExport({
        filename: `attendance_${year}`,
        data: exportData,
        format,
        title: `Attendance Report - ${year}`,
      });
    }
  }

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  }

  const dayByDate = new Map(days.map((d) => [d.date.slice(0, 10), d]));
  const allYearDays = yearMonths.flatMap((ym) => ym.days);
  const punchCounts = period === 'monthly' ? computePunchCounts(days) : computePunchCounts(allYearDays);

  // Present/Leave/Absent/LOP come from the server's own summary, not a raw
  // status count client-side — HalfDay contributes fractionally to both
  // Present and Absent there (see computePunchCounts's comment), and that
  // math is the same formula the summary already applies, so it is reused
  // rather than re-derived and risking disagreement with it.
  const yearSummaryTotals = yearMonths.reduce(
    (acc, ym) => ({
      totalWorkingDays: acc.totalWorkingDays + Number(ym.summary?.totalWorkingDays ?? 0),
      presentDays: acc.presentDays + Number(ym.summary?.presentDays ?? 0),
      leaveDays: acc.leaveDays + Number(ym.summary?.leaveDays ?? 0),
      absentDays: acc.absentDays + Number(ym.summary?.absentDays ?? 0),
      lopDays: acc.lopDays + Number(ym.summary?.lopDays ?? 0),
    }),
    { totalWorkingDays: 0, presentDays: 0, leaveDays: 0, absentDays: 0, lopDays: 0 }
  );
  const summaryTotals =
    period === 'monthly'
      ? {
          totalWorkingDays: Number(monthSummary?.totalWorkingDays ?? 0),
          presentDays: Number(monthSummary?.presentDays ?? 0),
          leaveDays: Number(monthSummary?.leaveDays ?? 0),
          absentDays: Number(monthSummary?.absentDays ?? 0),
          lopDays: Number(monthSummary?.lopDays ?? 0),
        }
      : yearSummaryTotals;

  // Sun-first calendar grid: leading blanks for the month's first weekday,
  // trailing blanks to complete the final week.
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlanks = firstOfMonth.getUTCDay();
  const cells: (Date | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(Date.UTC(year, month - 1, i + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = now.toISOString().slice(0, 10);
  const card = 'rounded-2xl border p-5';
  const cardStyle = { borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' };
  const segmented = 'flex items-center rounded-lg border p-0.5';
  const segStyle = { borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-subtle)' };
  const segBtn = (active: boolean) => ({
    backgroundColor: active ? 'var(--info)' : 'transparent',
    color: active ? '#fff' : 'var(--text-primary)',
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>My Attendance</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Your punch record, month by month or across the year.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={segmented} style={segStyle}>
            <button onClick={() => setPeriod('monthly')} className="rounded-md px-3 py-1.5 text-xs font-semibold transition" style={segBtn(period === 'monthly')}>
              Monthly
            </button>
            <button onClick={() => setPeriod('yearly')} className="rounded-md px-3 py-1.5 text-xs font-semibold transition" style={segBtn(period === 'yearly')}>
              Yearly
            </button>
          </div>
          {period === 'monthly' && (
            <div className={segmented} style={segStyle}>
              <button onClick={() => setViewMode('calendar')} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition" style={segBtn(viewMode === 'calendar')}>
                <CalendarDays className="h-3.5 w-3.5" />
                Calendar
              </button>
              <button onClick={() => setViewMode('table')} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition" style={segBtn(viewMode === 'table')}>
                <Table2 className="h-3.5 w-3.5" />
                Table
              </button>
            </div>
          )}
          <button
            onClick={() => exportAttendanceData('csv')}
            disabled={period === 'monthly' ? days.length === 0 : yearMonths.length === 0}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            onClick={() => exportAttendanceData('excel')}
            disabled={period === 'monthly' ? days.length === 0 : yearMonths.length === 0}
            className="rounded-lg border px-3 py-2 text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
          >
            Excel
          </button>
          <button
            onClick={() => exportAttendanceData('pdf')}
            disabled={period === 'monthly' ? days.length === 0 : yearMonths.length === 0}
            className="rounded-lg border px-3 py-2 text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
          >
            PDF
          </button>
        </div>
      </div>

      {/* KPI row — day counts for whichever period/scope is selected, not a
          fixed "today": the header above already says which month/year is
          in view, so these track it rather than always meaning "today." */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className={card} style={cardStyle}>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--success-soft)' }}>
              <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success)' }} />
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Present</span>
          </div>
          <div className="mt-3 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{summaryTotals.presentDays}</div>
          <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {summaryTotals.totalWorkingDays > 0
              ? `${Math.max(0, summaryTotals.totalWorkingDays - summaryTotals.presentDays)} days remaining`
              : `of ${days.length || allYearDays.length} recorded`}
          </div>
        </div>
        <div className={card} style={cardStyle}>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--warning-soft)' }}>
              <AlarmClockOff className="h-4 w-4" style={{ color: 'var(--warning)' }} />
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Late Entry</span>
          </div>
          <div className="mt-3 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{punchCounts.late}</div>
          <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{punchCounts.onTime} days on time</div>
        </div>
        <div className={card} style={cardStyle}>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--info-soft)' }}>
              <Palmtree className="h-4 w-4" style={{ color: 'var(--info)' }} />
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>On Leave</span>
          </div>
          <div className="mt-3 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{summaryTotals.leaveDays}</div>
          <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Approved Leave</div>
        </div>
        <div className={card} style={cardStyle}>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--danger-soft)' }}>
              <Frown className="h-4 w-4" style={{ color: 'var(--danger)' }} />
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Absent</span>
          </div>
          <div className="mt-3 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{summaryTotals.absentDays}</div>
          <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {summaryTotals.lopDays > 0 ? `${summaryTotals.lopDays} LOP` : 'No leave on record'}
          </div>
        </div>
      </div>

      <div className={card} style={cardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--border-main)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
              {period === 'monthly' ? (
                <>
                  <span className="uppercase">{MONTH_NAMES[month - 1].slice(0, 3)}</span>
                  <span className="text-sm" style={{ color: 'var(--info)' }}>{now.getMonth() + 1 === month && now.getFullYear() === year ? now.getDate() : ''}</span>
                </>
              ) : (
                <span className="text-sm" style={{ color: 'var(--info)' }}>{year}</span>
              )}
            </div>
            <div>
              <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {period === 'monthly' ? `${MONTH_NAMES[month - 1]} ${year}` : `Full Year ${year}`}
              </div>
              {period === 'monthly' && (
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })} – {new Date(Date.UTC(year, month, 0)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {period === 'monthly' && (
              <div className="flex items-center rounded-lg border" style={{ borderColor: 'var(--border-main)' }}>
                <button onClick={() => shiftMonth(-1)} className="p-2 hover:opacity-70" aria-label="Previous month" style={{ color: 'var(--text-primary)' }}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="w-28 text-center text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{MONTH_NAMES[month - 1]}</span>
                <button onClick={() => shiftMonth(1)} className="p-2 hover:opacity-70" aria-label="Next month" style={{ color: 'var(--text-primary)' }}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex items-center rounded-lg border" style={{ borderColor: 'var(--border-main)' }}>
              <button onClick={() => setYear((y) => y - 1)} className="p-2 hover:opacity-70" aria-label="Previous year" style={{ color: 'var(--text-primary)' }}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="w-14 text-center text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{year}</span>
              <button onClick={() => setYear((y) => y + 1)} className="p-2 hover:opacity-70" aria-label="Next year" style={{ color: 'var(--text-primary)' }}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : period === 'yearly' ? (
          /* Yearly — one rollup row per month. A 365-row day table would be
             unusable; this is the useful granularity for "how did my year
             look." */
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border-main)', color: 'var(--text-muted)' }}>
                  <th className="px-4 py-2">Month</th>
                  <th className="px-4 py-2">Present</th>
                  <th className="px-4 py-2">Absent</th>
                  <th className="px-4 py-2">Leave</th>
                  <th className="px-4 py-2">LOP</th>
                  <th className="px-4 py-2">Late (total)</th>
                  <th className="px-4 py-2">OT (total)</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {yearMonths.map((ym) => (
                  <tr key={ym.month} className="border-b" style={{ borderColor: 'var(--border-main)' }}>
                    <td className="px-4 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{MONTH_NAMES[ym.month - 1]}</td>
                    <td className="px-4 py-2">{ym.summary?.presentDays ?? '—'}</td>
                    <td className="px-4 py-2">{ym.summary?.absentDays ?? '—'}</td>
                    <td className="px-4 py-2">{ym.summary?.leaveDays ?? '—'}</td>
                    <td className="px-4 py-2">{ym.summary?.lopDays ?? '—'}</td>
                    <td className="px-4 py-2">{ym.summary ? hm(ym.summary.lateMinutesTotal) : '—'}</td>
                    <td className="px-4 py-2">{ym.summary ? hm(ym.summary.otMinutesTotal) : '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => { setMonth(ym.month); setPeriod('monthly'); }}
                        className="text-xs font-semibold"
                        style={{ color: 'var(--info)' }}
                      >
                        View month →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'table' ? (
          /* Monthly — day-level table, the pre-calendar layout kept as an
             option: same status resolution (resolveDayMeta) the calendar
             cells use, so the two views can never disagree. */
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border-main)', color: 'var(--text-muted)' }}>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Shift</th>
                  <th className="px-4 py-2">In</th>
                  <th className="px-4 py-2">Out</th>
                  <th className="px-4 py-2">Working Hrs</th>
                  <th className="px-4 py-2">Late</th>
                  <th className="px-4 py-2">Early Out</th>
                  <th className="px-4 py-2">OT</th>
                  <th className="px-4 py-2">LOM</th>
                  <th className="px-4 py-2">Permission</th>
                </tr>
              </thead>
              <tbody>
                {days.length === 0 && (
                  <tr><td colSpan={11} className="px-4 py-6 text-center" style={{ color: 'var(--text-muted)' }}>No attendance records for this month.</td></tr>
                )}
                {days.map((d) => {
                  const dateStr = d.date.slice(0, 10);
                  const meta = resolveDayMeta(dateStr, d, wfhRanges, pendingLeave) ?? { label: d.status, bg: 'var(--bg-subtle)', fg: 'var(--text-muted)' };
                  const otMinutes = d.otApprovalStatus === 'approved' ? (d.otMinutesApproved ?? 0) : d.otMinutesCalculated;
                  const lom = lomDisplay(d);
                  const perm = permissionDisplay(dateStr, permissions);
                  return (
                    <tr key={d.id} className="border-b" style={{ borderColor: 'var(--border-main)' }}>
                      <td className="px-4 py-2" style={{ color: 'var(--text-primary)' }}>
                        {new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short', timeZone: 'UTC' })}
                      </td>
                      <td className="px-4 py-2">
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: meta.bg, color: meta.fg }}>{meta.label}</span>
                      </td>
                      <td className="px-4 py-2" style={{ color: 'var(--text-muted)' }}>{d.shiftMaster?.code ?? '—'}</td>
                      <td className="px-4 py-2" style={{ color: 'var(--text-primary)' }}>{wallClock(d.inTime)}</td>
                      <td className="px-4 py-2" style={{ color: 'var(--text-primary)' }}>{wallClock(d.outTime)}</td>
                      <td className="px-4 py-2" style={{ color: 'var(--text-primary)' }}>{d.workingMinutes > 0 ? hm(d.workingMinutes) : '—'}</td>
                      <td className="px-4 py-2" style={{ color: d.lateMinutes > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{d.lateMinutes > 0 ? `${d.lateMinutes}m` : '—'}</td>
                      <td className="px-4 py-2" style={{ color: d.earlyOutMinutes > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{d.earlyOutMinutes > 0 ? `${d.earlyOutMinutes}m` : '—'}</td>
                      <td className="px-4 py-2" style={{ color: 'var(--text-primary)' }}>{otMinutes > 0 ? hm(otMinutes) : '—'}</td>
                      <td className="px-4 py-2" style={{ color: lom ? 'var(--warning)' : 'var(--text-muted)' }}>{lom ?? '—'}</td>
                      <td className="px-4 py-2" style={{ color: perm ? 'var(--info)' : 'var(--text-muted)' }}>{perm ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Monthly — calendar grid */
          <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-lg" style={{ backgroundColor: 'var(--border-main)' }}>
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="px-2 py-2 text-center text-xs font-semibold uppercase" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                {w}
              </div>
            ))}
            {cells.map((date, i) => {
              if (!date) return <div key={i} style={{ backgroundColor: 'var(--bg-card)' }} className="min-h-[92px]" />;
              const dateStr = date.toISOString().slice(0, 10);
              const row = dayByDate.get(dateStr);
              const isToday = dateStr === todayStr;
              const meta = resolveDayMeta(dateStr, row, wfhRanges, pendingLeave);
              const shiftLabel = row?.shiftMaster?.name ?? null;

              return (
                <div key={i} className="min-h-[92px] p-2" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <div
                    className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                    style={isToday ? { backgroundColor: 'var(--info)', color: '#fff' } : { color: 'var(--text-primary)' }}
                  >
                    {date.getUTCDate()}
                  </div>
                  {meta && (
                    <div className="rounded-md px-1.5 py-1 text-[11px] font-medium leading-tight" style={{ backgroundColor: meta.bg, color: meta.fg }}>
                      {meta.label}
                    </div>
                  )}
                  {shiftLabel && (
                    <div className="mt-1 truncate text-[10px]" style={{ color: 'var(--text-muted)' }} title={shiftLabel}>
                      {shiftLabel}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
