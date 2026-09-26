'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ReportBarChart, ReportMultiLineChart } from '@/components/ui/ReportCharts';
import { handleExport } from '@/lib/export-utils';
import { useToast } from '@/components/ui';
import { AnnouncementPopup } from '@/components/ess/AnnouncementPopup';

// ── Types matching /api/workforce/my-dashboard ────────────────────────────────

interface Profile {
  employeeCode: string;
  firstName: string;
  name: string;
  status: string;
  lifecycleState: string | null;
  photoPath: string | null;
  email: string | null;
  mobile: string | null;
  company: string | null;
  joinDate: string | null;
  department: string | null;
  designation: string | null;
  employeeType: string | null;
  reportingManager: string | null;
  reportingManagerCode: string | null;
  category: string | null;
}

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

interface MonthSummary {
  presentDays?: number;
  absentDays?: number;
  leaveDays?: number;
  halfDays?: number;
  weeklyOffs?: number;
  holidays?: number;
  totalWorkingMinutes?: number;
  totalOtMinutes?: number;
  [key: string]: unknown;
}

interface LeaveBal {
  leaveMasterId: number;
  code: string;
  name: string;
  opening: number;
  accrued: number;
  availed: number;
  carryForwardIn: number;
  adjusted: number;
  total: number;
  used: number;
  available: number;
  closing: number;
  pendingApproval: number;
}

interface DashboardPayload {
  profile: Profile;
  today: DayRow | null;
  month: { year: number; month: number; days: DayRow[]; summary: MonthSummary | null };
  leaveBalances: LeaveBal[];
  permission: {
    freeHoursPerMonth: number;
    approvedHours: number;
    pendingHours: number;
    usedHours: number;
    remainingHours: number;
  } | null;
  compOffBalance: {
    available: number;
    earned: number;
    used: number;
    expired: number;
    encashed: number;
  } | null;
  serviceRecords: {
    wfh: { approvedYear: number; pendingNow: number };
    onDuty: { approvedYear: number; pendingNow: number };
    mispunch: { approvedYear: number; pendingNow: number };
    shiftChange: { approvedYear: number; pendingNow: number };
    ot: { approvedHoursYear: number; pendingNow: number };
  };
  requests: Record<string, number>;
  approvals: Record<string, number>;
  isManager: boolean;
  latestPayslip: { id: number; netSalary: string; payrollRun: { year: number; month: number } } | null;
}

interface AnnouncementItem {
  id: number;
  title: string;
  category: string;
  priority: string;
  publishedAt: string | null;
  readAt: string | null;
}

// ── Attendance flag colours (matches the reference legend) ────────────────────

/** "2.5h", "4h" — trailing zeros are noise on a dashboard tile. */
const hrs = (n: number) => `${Number(n).toFixed(2).replace(/\.?0+$/, '')}h`;

const FLAG_META: Record<string, { label: string; color: string }> = {
  present:   { label: 'Present',   color: '#4f7df3' },
  late:      { label: 'Late',      color: '#f0b429' },
  earlyOut:  { label: 'Early Out', color: '#2ec4b6' },
  halfDay:   { label: 'Half Day',  color: '#f7d154' },
  absent:    { label: 'Absent',    color: '#ef5a3c' },
  shortDay:  { label: 'Short Day', color: '#f97316' },
  leave:     { label: 'Leave',     color: '#a855f7' },
  holiday:   { label: 'Holiday',   color: '#22b573' },
  weeklyOff: { label: 'Off',       color: '#94a3b8' },
  missing:   { label: 'Missing',   color: '#ec4899' },
  onDuty:    { label: 'On Duty',   color: '#0ea5e9' },
  lop:       { label: 'LOP',       color: '#b91c1c' },
  none:      { label: 'No Data',   color: '#3d4756' },
};

/**
 * DailyAttendance.status is a free string; the flag keys are what the colour
 * map is built on. flagForDay derives a flag from a whole row (it also reads
 * late/early minutes); this maps a bare status for the aggregated series,
 * where those minute columns are not carried.
 */
const STATUS_TO_FLAG: Record<string, string> = {
  Present: 'present',
  HalfDay: 'halfDay',
  Absent: 'absent',
  Leave: 'leave',
  Permission: 'leave',
  Holiday: 'holiday',
  WeeklyOff: 'weeklyOff',
  MissingPunch: 'missing',
  OnDuty: 'onDuty',
  LOP: 'lop',
};

function flagForDay(d: DayRow | undefined): keyof typeof FLAG_META {
  if (!d) return 'none';
  switch (d.status) {
    case 'Present':
      if (d.lateMinutes > 0) return 'late';
      if (d.earlyOutMinutes > 0) return 'earlyOut';
      return 'present';
    case 'Absent': return 'absent';
    case 'HalfDay': return 'halfDay';
    case 'Leave': return 'leave';
    case 'WeeklyOff': return 'weeklyOff';
    case 'Holiday': return 'holiday';
    case 'MissingPunch': return 'missing';
    case 'Permission': return 'shortDay';
    case 'OnDuty': return 'onDuty';
    case 'LOP': return 'lop';
    default: return 'present';
  }
}

const fmtTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-';

const fmtTimeSecs = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : null;

const fmtDate = (iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'UTC', ...opts }) : '-';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ── Small components ──────────────────────────────────────────────────────────

function Donut({ available, total, color }: { available: number; total: number; color: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, Math.max(0, available / total)) : 0;
  return (
    <svg width="92" height="92" viewBox="0 0 92 92">
      <circle cx="46" cy="46" r={r} fill="none" stroke="var(--chart-track)" strokeWidth="9" />
      <circle
        cx="46" cy="46" r={r} fill="none"
        stroke={color} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${pct * c} ${c}`}
        transform="rotate(-90 46 46)"
      />
      <text x="46" y="40" textAnchor="middle" fontSize="10" fill="var(--foreground-muted)">Available</text>
      <text x="46" y="58" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--foreground)">
        {available}/{total}
      </text>
    </svg>
  );
}

const DONUT_COLORS = ['#4f7df3', '#f5a623', '#22b573', '#a855f7', '#ef5a3c'];

function FingerprintIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 11c1.7 0 3 1.3 3 3 0 2.5-.3 4.5-1 6" />
      <path d="M9 14c0 3-.3 5.2-1 7" />
      <path d="M12 8a6 6 0 0 1 6 6c0 2.2-.2 4-.6 5.5" />
      <path d="M6 14a6 6 0 0 1 1.5-4" />
      <path d="M4.5 9.5A9 9 0 0 1 12 5a9 9 0 0 1 9 9c0 1.8-.1 3.3-.4 4.7" />
      <path d="M3 12.5c0 2.4.2 4.4.7 6" />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EssDashboardPage() {
  const toast = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [metric, setMetric] = useState<'worked' | 'ot'>('worked');
  const [flagRange, setFlagRange] = useState<'week' | 'month' | 'year'>('month');
  const [flagData, setFlagData] = useState<{
    statuses: string[];
    buckets: Array<{ g: string; label: string; sort: string; status: string; count: number }>;
  } | null>(null);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [entryTab, setEntryTab] = useState<'missing' | 'absent'>('missing');
  const [reqTab, setReqTab] = useState<'requests' | 'approvals'>('requests');
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [announcementsUnread, setAnnouncementsUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/workforce/my-dashboard?year=${year}&month=${month}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelled && json) setData(json); })
      .catch(() => { if (!cancelled) toast.error('Failed to load dashboard.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year, month, toast]);

  // True while a month switch fetch is in flight — the loaded payload still
  // reflects the previously selected month.
  const refreshing = data !== null && (data.month.year !== year || data.month.month !== month);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/workforce/my-attendance-flags?years=2')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelled && json) setFlagData(json); })
      .catch(() => { if (!cancelled) toast.error('Failed to load attendance flags.'); });
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/workforce/my-announcements')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        setAnnouncements((json.data ?? []).slice(0, 5));
        setAnnouncementsUnread(json.unreadCount ?? 0);
      })
      .catch(() => { if (!cancelled) toast.error('Failed to load announcements.'); });
    return () => { cancelled = true; };
  }, [toast]);

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const chartData = useMemo(() => {
    const byDay = new Map<number, DayRow>();
    for (const d of data?.month.days ?? []) byDay.set(new Date(d.date).getUTCDate(), d);
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const row = byDay.get(day);
      const flag = flagForDay(row);
      const minutes = metric === 'worked' ? (row?.workingMinutes ?? 0) : (row?.otMinutesApproved ?? row?.otMinutesCalculated ?? 0);
      return {
        day: `${day} ${MONTH_NAMES[month - 1].slice(0, 3)}`,
        hours: Math.round((minutes / 60) * 100) / 100,
        flag,
        status: row?.status ?? 'No record',
        // The bar's colour IS the attendance flag, so it travels with the row
        // rather than being looked up again at render time.
        color: FLAG_META[flag].color,
        // A day with no hours still shows a stub bar; fading it keeps it from
        // reading as a real value.
        fade: minutes === 0 ? 0.45 : 1,
      };
    });
  }, [data, daysInMonth, month, metric]);

  /** One line per attendance status across the chosen period buckets. */
  const flagSeries = useMemo(() => {
    const buckets = (flagData?.buckets ?? []).filter((b) => b.g === flagRange);
    const columns = Array.from(new Set(buckets.map((b) => b.sort)))
      .sort()
      .map((sort) => ({ sort, label: buckets.find((b) => b.sort === sort)?.label ?? sort }));

    const byStatus = new Map<string, number[]>();
    for (const b of buckets) {
      const idx = columns.findIndex((c) => c.sort === b.sort);
      if (idx < 0) continue;
      const cells = byStatus.get(b.status) ?? Array(columns.length).fill(0);
      cells[idx] += b.count;
      byStatus.set(b.status, cells);
    }

    return {
      columns: columns.map((c) => c.label),
      series: Array.from(byStatus.entries())
        // A status the employee never had would be a flat zero line; drop it
        // rather than crowd the legend with it.
        .filter(([, values]) => values.some((v) => v > 0))
        .map(([status, values]) => ({
          name: FLAG_META[STATUS_TO_FLAG[status] ?? 'none']?.label ?? status,
          values,
          color: FLAG_META[STATUS_TO_FLAG[status] ?? 'none']?.color,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [flagData, flagRange]);

  const missingEntries = useMemo(
    () => (data?.month.days ?? []).filter((d) => d.status === 'MissingPunch' || (d.status === 'Present' && (!d.inTime || !d.outTime))).slice(-8).reverse(),
    [data],
  );
  const absentEntries = useMemo(
    () => (data?.month.days ?? []).filter((d) => d.status === 'Absent' || d.status === 'LOP').slice(-8).reverse(),
    [data],
  );

  const requestItems = [
    { key: 'leave',       label: 'Leave Requests',             href: '/ess/leave' },
    { key: 'mispunch',    label: 'Attendance (Mis-Punch) Requests', href: '/ess/mis-punch' },
    { key: 'permission',  label: 'Permission Requests',        href: '/ess/permission' },
    { key: 'onDuty',      label: 'On-Duty Requests',           href: '/ess/on-duty' },
    { key: 'wfh',         label: 'Remote Work (WFH) Requests', href: '/ess/wfh' },
    { key: 'shiftChange', label: 'Shift Change Requests',      href: '/ess/shift-change' },
    { key: 'loan',        label: 'Loan Requests',              href: '/ess/loans' },
    { key: 'compOff',     label: 'Comp-Off Requests',          href: '/ess/comp-off' },
    { key: 'encashment',  label: 'Leave Encashment Requests',  href: '/ess/leave-encashment' },
    { key: 'otRequest',   label: 'OT Requests',                href: '/ess/ot-request' },
  ];

  const approvalItems = [
    { key: 'leave',      label: 'Leave Approvals',      href: '/approvals/workforce/leave' },
    { key: 'mispunch',   label: 'Mis-Punch Approvals',  href: '/approvals/workforce/mispunch' },
    { key: 'permission', label: 'Permission Approvals', href: '/approvals/workforce/permission' },
    { key: 'onDuty',     label: 'On-Duty Approvals',    href: '/approvals/workforce/on-duty' },
    { key: 'wfh',        label: 'WFH Approvals',        href: '/approvals/workforce/wfh' },
    { key: 'ot',         label: 'OT Approvals',         href: '/approvals/workforce/overtime' },
  ];

  const profile = data?.profile;
  const today = data?.today;
  const summary = data?.month.summary;
  const signedInAt = fmtTimeSecs(today?.inTime);
  const signedOutAt = fmtTimeSecs(today?.outTime);

  const presentDays = summary?.presentDays ?? (data?.month.days ?? []).filter((d) => ['Present', 'OnDuty'].includes(d.status)).length;
  const absentDays = summary?.absentDays ?? (data?.month.days ?? []).filter((d) => ['Absent', 'LOP'].includes(d.status)).length;
  const leaveDays = summary?.leaveDays ?? (data?.month.days ?? []).filter((d) => d.status === 'Leave').length;
  const totalWorkedMin = summary?.totalWorkingMinutes ?? (data?.month.days ?? []).reduce((s, d) => s + (d.workingMinutes ?? 0), 0);
  const totalOtMin = summary?.totalOtMinutes ?? (data?.month.days ?? []).reduce((s, d) => s + (d.otMinutesApproved ?? d.otMinutesCalculated ?? 0), 0);

  const card = 'card p-5';
  const muted = { color: 'var(--foreground-muted)' };
  const fg = { color: 'var(--foreground)' };

  return (
    <div className="space-y-5">
      {/* Celebratory unread-announcement card — queues every unread item
          and posts a read receipt on Confirm. Renders nothing when the
          employee is caught up. */}
      <AnnouncementPopup />
      {/* Tabs + greeting header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex gap-6 border-b" style={{ borderColor: 'var(--border)' }}>
          <span
            className="border-b-2 pb-2 text-sm font-semibold"
            style={{ borderColor: 'var(--info)', color: 'var(--info)' }}
          >
            ESS Dashboard
          </span>
          <Link href="/ess/attendance" className="pb-2 text-sm font-medium hover:opacity-80" style={muted}>
            Attendance Dashboard
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-bold" style={fg}>Hello {profile?.firstName || 'there'}!</p>
            <p className="text-xs" style={muted}>We hope you&apos;re having a great day</p>
          </div>
          {profile?.photoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.photoPath} alt={profile.name} className="h-11 w-11 rounded-full object-cover ring-2" style={{ ['--tw-ring-color' as never]: 'var(--accent)' }} />
          ) : (
            <span className="grid h-11 w-11 place-items-center rounded-full text-sm font-bold text-white" style={{ background: 'var(--accent)' }}>
              {(profile?.firstName ?? 'E')[0]}
            </span>
          )}
        </div>
      </div>

      {/* Row 1: profile card + attendance flag chart */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Profile card */}
        <div className={card}>
          <div className="flex flex-col items-center pt-2">
            <div className="relative">
              {profile?.photoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photoPath} alt={profile.name} className="h-24 w-24 rounded-full object-cover" style={{ boxShadow: '0 0 0 3px var(--info-soft), 0 0 0 5px var(--info)' }} />
              ) : (
                <span className="grid h-24 w-24 place-items-center rounded-full text-2xl font-bold text-white" style={{ background: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft), 0 0 0 5px var(--accent)' }}>
                  {(profile?.firstName ?? 'E')[0]}
                </span>
              )}
              <Link
                href="/ess/profile"
                title="Edit profile"
                className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border bg-[color:var(--surface)]"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
              </Link>
            </div>
            <h2 className="mt-4 text-lg font-bold" style={fg}>{profile?.name ?? (loading ? 'Loading…' : 'Employee')}</h2>
            <p className="text-xs" style={muted}>{profile?.designation ?? ''}</p>
            <div className="mt-2 flex gap-2">
              {profile?.employeeType && (
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}>{profile.employeeType}</span>
              )}
              {profile?.lifecycleState && (
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>{profile.lifecycleState}</span>
              )}
            </div>
          </div>
          <div className="mt-5 space-y-2.5 text-[13px]">
            {[
              { icon: 'calendar' as const, text: profile?.mobile },
              { icon: 'calendar' as const, text: profile?.email },
              { icon: 'calendar' as const, text: profile?.department },
              { icon: 'calendar' as const, text: profile?.joinDate ? fmtDate(profile.joinDate) : null },
              // Reporting manager — labelled, because a bare name next to the
              // department reads as just another org field.
              {
                icon: 'manager' as const,
                text: profile?.reportingManager ? `Reports to ${profile.reportingManager}` : null,
              },
            ].filter((row) => Boolean(row.text)).map((row, i) => (
              <div key={i} className="flex items-center gap-2.5" style={muted}>
                {row.icon === 'manager' ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></svg>
                )}
                <span className="truncate">{row.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance Flag Summary */}
        <div className={`${card} lg:col-span-2`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold" style={fg}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2" strokeLinecap="round"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></svg>
              Attendance Flag Summary
            </h3>
            <div className="flex gap-2">
              <span className="rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: 'var(--border)', ...muted }}>
                {profile?.name} {profile?.employeeCode}
              </span>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as 'worked' | 'ot')}
                className="rounded-full border bg-transparent px-3 py-1 text-xs font-medium outline-none"
                style={{ borderColor: 'var(--border)', ...fg }}
              >
                <option value="worked">Total Worked Hours</option>
                <option value="ot">OT Hours</option>
              </select>
              <div className="inline-flex rounded-full border p-0.5" style={{ borderColor: 'var(--border)' }}>
                {(['week', 'month', 'year'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFlagRange(r)}
                    className="cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium capitalize transition-colors"
                    style={
                      flagRange === r
                        ? { background: 'var(--primary)', color: '#fff' }
                        : { color: 'var(--foreground-muted)' }
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
              <select
                value={`${year}-${month}`}
                onChange={(e) => {
                  const [y, m] = e.target.value.split('-').map(Number);
                  setYear(y); setMonth(m);
                }}
                className="rounded-full border bg-transparent px-3 py-1 text-xs font-medium outline-none"
                style={{ borderColor: 'var(--border)', ...fg }}
              >
                <option value={`${now.getUTCFullYear()}-${now.getUTCMonth() + 1}`}>Current Month</option>
                <option value={`${new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).getUTCFullYear()}-${new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).getUTCMonth() + 1}`}>Last Month</option>
              </select>
            </div>
          </div>

          <div className="mt-2 transition-opacity" style={{ height: 240, opacity: refreshing || loading ? 0.45 : 1 }}>
            {/* Days counted per attendance flag, one line per flag. The
                per-day hours bar chart moved below — it answers a different
                question (how long did I work) than this one (how did my days
                break down). */}
            <ReportMultiLineChart
              columns={flagSeries.columns}
              series={flagSeries.series}
              valueFormatter={(v) => `${v} day${v === 1 ? '' : 's'}`}
            />
          </div>
        </div>
      </div>

      {/* Daily worked / OT hours — kept from the original card, which the flag
          summary above replaced. */}
      <div className={card}>
        <h3 className="flex items-center gap-2 text-sm font-bold" style={fg}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2" strokeLinecap="round"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></svg>
          {metric === 'worked' ? 'Daily Worked Hours' : 'Daily OT Hours'}
          <span className="ml-auto text-[11px] font-medium" style={muted}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
        </h3>
        <div className="mt-2 transition-opacity" style={{ height: 220, opacity: refreshing || loading ? 0.45 : 1 }}>
          <ReportBarChart
            data={chartData}
            xKey="day"
            yKey="hours"
            colorKey="color"
            opacityKey="fade"
            seriesName={metric === 'worked' ? 'Worked' : 'OT'}
            valueFormatter={(v, row) =>
              `${v} hrs · ${(row as { status?: string } | undefined)?.status ?? ''}`
            }
            xTickAngle={-45}
            xTickHeight={48}
            xTickFontSize={9}
          />
        </div>
      </div>

      {/* Row 2: today attendance | entries tabs | leave donuts | requests */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {/* Today attendance */}
        <div className={card}>
          <h3 className="flex items-center gap-2 text-sm font-bold" style={fg}>
            <span style={{ color: 'var(--info)' }}><FingerprintIcon /></span>
            Attendance
          </h3>
          <div className="mt-6 flex flex-col items-center text-center">
            <span className="rounded-md border px-2.5 py-1 text-[11px]" style={{ borderColor: 'var(--border)', ...muted }}>
              {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            {signedInAt ? (
              <>
                <p className="mt-4 text-xs" style={muted}>You signed in today at</p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight" style={fg}>{signedInAt}</p>
                {signedOutAt && <p className="mt-1 text-xs" style={muted}>Signed out at {signedOutAt}</p>}
              </>
            ) : (
              <>
                <p className="mt-4 text-xs" style={muted}>No sign-in recorded today</p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight" style={fg}>--:--:--</p>
              </>
            )}
            {today?.status === 'MissingPunch' ? (
              <Link
                href="/ess/mis-punch"
                className="mt-5 w-full rounded-lg py-2.5 text-center text-sm font-semibold text-white"
                style={{ background: 'var(--info)' }}
              >
                Fix Mis-Punch
              </Link>
            ) : (
              <Link
                href="/ess/attendance"
                className="mt-5 w-full rounded-lg py-2.5 text-center text-sm font-semibold text-white"
                style={{ background: 'var(--info)' }}
              >
                View My Attendance
              </Link>
            )}
          </div>
        </div>

        {/* Missing / Absent entries */}
        <div className={card}>
          <div className="flex gap-4 border-b" style={{ borderColor: 'var(--border)' }}>
            {([['missing', 'Missing Entry'], ['absent', 'Absent Entry']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setEntryTab(key)}
                className="flex items-center gap-1.5 border-b-2 pb-2 text-xs font-semibold"
                style={{
                  borderColor: entryTab === key ? 'var(--info)' : 'transparent',
                  color: entryTab === key ? 'var(--info)' : 'var(--foreground-muted)',
                }}
              >
                {key === 'missing' ? '⚠' : '⊘'} {label}
              </button>
            ))}
          </div>
          <table className="mt-3 w-full text-[12px]">
            <thead>
              <tr className="text-left" style={muted}>
                <th className="pb-2 font-medium">S.No</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">In</th>
                <th className="pb-2 font-medium">Out</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(entryTab === 'missing' ? missingEntries : absentEntries).map((d, i) => (
                <tr key={d.id} className="border-t" style={{ borderColor: 'var(--border)', ...fg }}>
                  <td className="py-2">{String(i + 1).padStart(2, '0')}</td>
                  <td className="py-2">{fmtDate(d.date, { year: '2-digit' })}</td>
                  <td className="py-2">{fmtTime(d.inTime)}</td>
                  <td className="py-2">{fmtTime(d.outTime)}</td>
                  <td className="py-2">
                    <span className="font-medium" style={{ color: entryTab === 'missing' ? '#ec4899' : '#ef5a3c' }}>
                      {entryTab === 'missing' ? 'Missing' : d.status}
                    </span>
                  </td>
                </tr>
              ))}
              {(entryTab === 'missing' ? missingEntries : absentEntries).length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center" style={muted}>No {entryTab} entries this month</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Leave summary donuts */}
        <div className={card}>
          <h3 className="flex items-center gap-2 text-sm font-bold" style={fg}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2" strokeLinecap="round"><path d="M6 2v20M6 4h12l-3 4 3 4H6" /></svg>
            Leave Summary
          </h3>
          <div className="mt-4 flex flex-wrap items-center justify-around gap-4">
            {data?.leaveBalances.slice(0, 2).map((b, i) => (
              <div key={b.leaveMasterId} className="flex flex-col items-center">
                <Donut available={b.available} total={b.total} color={DONUT_COLORS[i % DONUT_COLORS.length]} />
                <p className="mt-2 text-center text-xs font-medium" style={fg}>{b.name}</p>
              </div>
            ))}
            {(!data || data.leaveBalances.length === 0) && !loading && (
              <p className="py-8 text-xs" style={muted}>No leave balances for {year}</p>
            )}
          </div>
          {data && data.leaveBalances.length > 2 && (
            <div className="mt-3 space-y-1.5 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              {data.leaveBalances.slice(2, 5).map((b) => (
                <div key={b.leaveMasterId} className="flex items-center justify-between text-xs">
                  <span style={muted}>{b.name}</span>
                  <span className="font-semibold" style={fg}>{b.available}/{b.total}</span>
                </div>
              ))}
            </div>
          )}
          <Link href="/ess/leave" className="mt-4 block text-center text-xs font-semibold" style={{ color: 'var(--info)' }}>
            View all leave →
          </Link>

          {/* Permission (short leave) balance for the current month. Hours
              awaiting approval are shown spent — the employee should not plan
              against hours they have already asked for. */}
          {data?.permission && (
            <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold" style={fg}>Permission Balance</span>
                <span className="text-xs" style={muted}>this month</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold" style={{ color: data.permission.remainingHours > 0 ? 'var(--info)' : '#ef5a3c' }}>
                  {hrs(data.permission.remainingHours)}
                </span>
                <span className="text-xs" style={muted}>left of {hrs(data.permission.freeHoursPerMonth)}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--border)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, data.permission.freeHoursPerMonth > 0 ? (data.permission.usedHours / data.permission.freeHoursPerMonth) * 100 : 0)}%`,
                    backgroundColor: data.permission.usedHours > data.permission.freeHoursPerMonth ? '#ef5a3c' : 'var(--info)',
                  }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs" style={muted}>
                <span>Used {hrs(data.permission.usedHours)}</span>
                {data.permission.pendingHours > 0 && <span>{hrs(data.permission.pendingHours)} awaiting approval</span>}
              </div>
              <Link href="/ess/permission" className="mt-3 block text-center text-xs font-semibold" style={{ color: 'var(--info)' }}>
                Apply for permission →
              </Link>
            </div>
          )}

          {/* Comp-off balance — earned by working a weekly-off/holiday, spent by
              taking a day off. `used` and `expired` are all-time running totals
              off CompOffBalance, not scoped to `year`; the balance is a running
              account, not something that resets each year the way leave does. */}
          {data?.compOffBalance && (
            <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold" style={fg}>Comp-Off Balance</span>
                <span className="text-xs" style={muted}>days</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold" style={{ color: data.compOffBalance.available > 0 ? 'var(--info)' : muted.color }}>
                  {data.compOffBalance.available}
                </span>
                <span className="text-xs" style={muted}>available of {data.compOffBalance.earned} earned</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--border)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, data.compOffBalance.earned > 0 ? (data.compOffBalance.used / data.compOffBalance.earned) * 100 : 0)}%`,
                    backgroundColor: 'var(--info)',
                  }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs" style={muted}>
                <span>Used {data.compOffBalance.used}</span>
                {data.compOffBalance.expired > 0 && <span>{data.compOffBalance.expired} expired</span>}
              </div>
              <Link href="/ess/comp-off" className="mt-3 block text-center text-xs font-semibold" style={{ color: 'var(--info)' }}>
                View comp-off →
              </Link>
            </div>
          )}
        </div>

        {/* My Requests / My approvals */}
        <div className={card}>
          <div className="flex gap-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setReqTab('requests')}
              className="flex items-center gap-1.5 border-b-2 pb-2 text-xs font-semibold"
              style={{
                borderColor: reqTab === 'requests' ? 'var(--info)' : 'transparent',
                color: reqTab === 'requests' ? 'var(--info)' : 'var(--foreground-muted)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v12H8l-4 4Z" /></svg>
              My Requests
            </button>
            <button
              onClick={() => setReqTab('approvals')}
              className="flex items-center gap-1.5 border-b-2 pb-2 text-xs font-semibold"
              style={{
                borderColor: reqTab === 'approvals' ? 'var(--info)' : 'transparent',
                color: reqTab === 'approvals' ? 'var(--info)' : 'var(--foreground-muted)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="3" /><path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" /></svg>
              My approvals
            </button>
          </div>
          <div className="mt-3 space-y-1">
            {(reqTab === 'requests' ? requestItems : approvalItems).map((item) => {
              const count = (reqTab === 'requests' ? data?.requests : data?.approvals)?.[item.key] ?? 0;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-center justify-between rounded-lg px-2 py-2 text-[12.5px] transition hover:bg-[color:var(--surface-hover)]"
                  style={fg}
                >
                  <span>List of {item.label}</span>
                  <span
                    className="grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[11px] font-bold"
                    style={{
                      background: count > 0 ? 'var(--info-soft)' : 'var(--surface-muted)',
                      color: count > 0 ? 'var(--info)' : 'var(--foreground-muted)',
                    }}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
            {reqTab === 'approvals' && data && !data.isManager && (
              <p className="px-2 py-4 text-xs" style={muted}>You don&apos;t have any reportees — nothing to approve.</p>
            )}
          </div>
        </div>
      </div>

      {/* My Service Records — the "used vs. still pending" view for every
          request type, in one place. Leave and Permission already get their
          own detail above (balance table, monthly stat card); this covers
          the rest, none of which has a quota to show a balance for, so
          "approved this year" stands in for it — the plain answer to "how
          much of this have I actually taken." */}
      <div className={card}>
        <h3 className="text-sm font-bold" style={fg}>My Service Records ({year})</h3>
        <p className="mt-1 text-xs" style={muted}>
          What you&apos;ve had approved this year, and what&apos;s still waiting on a decision.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)', ...muted }}>
                <th className="px-3 py-2 font-medium">Service</th>
                <th className="px-3 py-2 font-medium">Approved ({year})</th>
                <th className="px-3 py-2 font-medium">Pending Now</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'wfh', label: 'Work From Home', unit: 'days', value: data?.serviceRecords?.wfh.approvedYear, pending: data?.serviceRecords?.wfh.pendingNow, href: '/ess/wfh' },
                { key: 'onDuty', label: 'On-Duty', unit: 'days', value: data?.serviceRecords?.onDuty.approvedYear, pending: data?.serviceRecords?.onDuty.pendingNow, href: '/ess/on-duty' },
                { key: 'mispunch', label: 'Mis-Punch Corrections', unit: '', value: data?.serviceRecords?.mispunch.approvedYear, pending: data?.serviceRecords?.mispunch.pendingNow, href: '/ess/mis-punch' },
                { key: 'shiftChange', label: 'Shift Change', unit: '', value: data?.serviceRecords?.shiftChange.approvedYear, pending: data?.serviceRecords?.shiftChange.pendingNow, href: '/ess/shift-change' },
                { key: 'ot', label: 'Overtime', unit: 'h', value: data?.serviceRecords?.ot.approvedHoursYear, pending: data?.serviceRecords?.ot.pendingNow, href: '/ess/ot-request' },
              ].map((row) => (
                <tr key={row.key} className="border-b last:border-0" style={{ borderColor: 'var(--border)', ...fg }}>
                  <td className="px-3 py-2 font-medium">{row.label}</td>
                  <td className="px-3 py-2">{row.value ?? '—'}{row.value != null && row.unit ? ` ${row.unit}` : ''}</td>
                  <td className="px-3 py-2">
                    {(row.pending ?? 0) > 0 ? (
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                        {row.pending} pending
                      </span>
                    ) : (
                      <span style={muted}>None</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link href={row.href} className="font-semibold" style={{ color: 'var(--info)' }}>
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
              {!data && (
                <tr><td colSpan={4} className="px-3 py-6 text-center" style={muted}>Loading…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leave Balance table — same shape as the My Leave page */}
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold" style={fg}>Leave Balance ({year})</h3>
          <div className="flex items-center gap-2">
            {(['csv', 'excel', 'pdf'] as const).map((fmt) => (
              <button
                key={fmt}
                disabled={!data || data.leaveBalances.length === 0}
                onClick={() =>
                  handleExport({
                    filename: `leave-balance_${year}`,
                    format: fmt,
                    title: `Leave Balance - ${year}`,
                    data: (data?.leaveBalances ?? []).map((b) => ({
                      'Leave Type': b.name,
                      'Opening': b.opening.toFixed(1),
                      'Accrued': b.accrued.toFixed(1),
                      'Availed': b.availed.toFixed(1),
                      'Closing Balance': b.closing.toFixed(1),
                    })),
                  })
                }
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--info)' }}
              >
                {fmt === 'excel' ? 'Excel' : fmt.toUpperCase()}
              </button>
            ))}
            <span className="rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border)', ...fg }}>
              {year}
            </span>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider" style={{ borderColor: 'var(--border)', ...muted }}>
                <th className="px-3 py-2 font-medium">Leave Type</th>
                <th className="px-3 py-2 font-medium">Opening</th>
                <th className="px-3 py-2 font-medium">Accrued</th>
                <th className="px-3 py-2 font-medium">Availed</th>
                <th className="px-3 py-2 font-medium">Closing Balance</th>
              </tr>
            </thead>
            <tbody>
              {(data?.leaveBalances ?? []).map((b) => (
                <tr key={b.leaveMasterId} className="border-b last:border-0" style={{ borderColor: 'var(--border)', ...fg }}>
                  <td className="px-3 py-2.5 font-medium">{b.name}</td>
                  <td className="px-3 py-2.5">{b.opening.toFixed(1)}</td>
                  <td className="px-3 py-2.5">{b.accrued.toFixed(1)}</td>
                  <td className="px-3 py-2.5">{b.availed.toFixed(1)}</td>
                  <td className="px-3 py-2.5 font-semibold">{b.closing.toFixed(1)}</td>
                </tr>
              ))}
              {(!data || data.leaveBalances.length === 0) && !loading && (
                <tr><td colSpan={5} className="px-3 py-6 text-center" style={muted}>No leave balance set up for {year} yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: attendance summary | payslip | quick access */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Attendance summary */}
        <div className={card}>
          <h3 className="flex items-center gap-2 text-sm font-bold" style={fg}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></svg>
            Attendance Summary · {MONTH_NAMES[month - 1].slice(0, 3)} {year}
          </h3>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: 'Present', value: presentDays, color: FLAG_META.present.color },
              { label: 'Absent', value: absentDays, color: FLAG_META.absent.color },
              { label: 'Leave', value: leaveDays, color: FLAG_META.leave.color },
              { label: 'Worked Hrs', value: Math.round(totalWorkedMin / 60), color: 'var(--info)' },
              { label: 'OT Hrs', value: Math.round(totalOtMin / 60 * 10) / 10, color: 'var(--warning)' },
              { label: 'Missing', value: missingEntries.length, color: FLAG_META.missing.color },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'var(--surface-muted)' }}>
                <p className="text-lg font-extrabold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[11px]" style={muted}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Payslip */}
        <div className={card}>
          <h3 className="flex items-center gap-2 text-sm font-bold" style={fg}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2" strokeLinecap="round"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z" /><path d="M9 7h6M9 11h6" /></svg>
            Employee Payslip
          </h3>
          {data?.latestPayslip ? (
            <div className="mt-6 flex flex-col items-center text-center">
              <p className="text-xs" style={muted}>
                {MONTH_NAMES[data.latestPayslip.payrollRun.month - 1]} {data.latestPayslip.payrollRun.year} · Net Pay
              </p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight" style={fg}>
                ₹{Number(data.latestPayslip.netSalary).toLocaleString('en-IN')}
              </p>
              <Link
                href="/ess/payslip"
                className="mt-5 w-full rounded-lg py-2.5 text-center text-sm font-semibold text-white"
                style={{ background: 'var(--info)' }}
              >
                View Payslips
              </Link>
            </div>
          ) : (
            <p className="py-10 text-center text-xs" style={muted}>
              {loading ? 'Loading…' : 'No published payslip yet'}
            </p>
          )}
        </div>

        {/* Quick access */}
        <div className={card}>
          <h3 className="flex items-center gap-2 text-sm font-bold" style={fg}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2" strokeLinecap="round"><path d="M13 2 3 14h7l-1 8 10-12h-7Z" /></svg>
            Quick Access
          </h3>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {[
              { label: 'Attendance', href: '/ess/attendance' },
              { label: 'Leave', href: '/ess/leave' },
              { label: 'Payslip', href: '/ess/payslip' },
              { label: 'Profile', href: '/ess/profile' },
              { label: 'Documents', href: '/ess/documents' },
              { label: 'Holidays', href: '/ess/holiday-calendar' },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-xl border py-3 text-center text-[11.5px] font-medium transition hover:border-[color:var(--info)]"
                style={{ borderColor: 'var(--border)', ...fg }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Announcements */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold" style={fg}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2" strokeLinecap="round"><path d="M3 11v3a1 1 0 0 0 1 1h1l3 4v-4h9a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v0" /></svg>
            Announcements
            {announcementsUnread > 0 && (
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: 'var(--danger)' }}>
                {announcementsUnread} unread
              </span>
            )}
          </h3>
          <Link href="/ess/announcements" className="text-xs font-semibold" style={{ color: 'var(--info)' }}>
            View all
          </Link>
        </div>
        <div className="mt-4 space-y-2">
          {announcements.length === 0 ? (
            <p className="py-6 text-center text-xs" style={muted}>No announcements right now.</p>
          ) : (
            announcements.map((a) => (
              <Link
                key={a.id}
                href={`/ess/announcements?id=${a.id}`}
                className="flex items-center gap-3 rounded-xl border px-3 py-2.5 transition hover:border-[color:var(--info)]"
                style={{ borderColor: 'var(--border)' }}
              >
                {!a.readAt && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--info)' }} />}
                <span className="min-w-0 flex-1 truncate text-[13px]" style={fg}>{a.title}</span>
                {a.priority === 'IMPORTANT' && (
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                    IMPORTANT
                  </span>
                )}
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'var(--surface-muted)', color: 'var(--foreground-muted)' }}>
                  {a.category}
                </span>
                <span className="shrink-0 text-[11px]" style={muted}>{fmtDate(a.publishedAt)}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
