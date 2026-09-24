'use client';

/**
 * One report's month, day by day — check-in / check-out / status. The ESS
 * (reporting-manager) equivalent of the HR Monthly Attendance page, scoped
 * to a single report and gated server-side by the reporting-manager
 * relationship (see /api/workforce/my-team/[id]/attendance). Uses the shared
 * DataTable for column alignment, and the same "Remaining <type>" KPI cards
 * as the employee's own My Requests page.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DataTable, type Column } from '@/components/ui';
import LeaveTypeKpiCard, { leaveCardColor } from '@/components/ess/LeaveTypeKpiCard';

interface DayRow {
  id: number;
  date: string;
  status: string;
  inTime: string | null;
  outTime: string | null;
  workingMinutes: number;
  lateMinutes: number;
  earlyOutMinutes: number;
  shiftMaster: { code: string; name: string } | null;
}

interface LeaveTypeBalance {
  leaveMasterId: number;
  name: string;
  available: number;
  used: number;
}

interface AttendanceResponse {
  employee: { id: number; employeeCode: string | null; name: string; designation: string | null; department: string | null };
  year: number;
  month: number;
  days: DayRow[];
  leaveByType: LeaveTypeBalance[];
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function fmtTime(t: string | null) {
  if (!t) return '—';
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const STATUS_COLOR: Record<string, string> = {
  Present: 'var(--success)',
  Absent: 'var(--danger)',
  LOP: 'var(--danger)',
  Leave: 'var(--info)',
  WeeklyOff: 'var(--foreground-muted)',
  Holiday: 'var(--foreground-muted)',
  MissingPunch: '#ec4899',
  HalfDay: '#f5a623',
};

export default function TeamMemberAttendancePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/workforce/my-team/${params.id}/attendance?year=${year}&month=${month}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? 'Failed to load attendance');
        return json;
      })
      .then((json) => { if (!cancelled) { setData(json); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load attendance'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params.id, year, month]);

  const fg = { color: 'var(--foreground)' };
  const muted = { color: 'var(--foreground-muted)' };

  const columns: Column<DayRow>[] = [
    {
      key: 'date',
      label: 'Date',
      render: (d) => new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' }),
    },
    { key: 'shiftMaster', label: 'Shift', render: (d) => d.shiftMaster?.name ?? '—' },
    { key: 'inTime', label: 'Check-In', render: (d) => fmtTime(d.inTime) },
    { key: 'outTime', label: 'Check-Out', render: (d) => fmtTime(d.outTime) },
    { key: 'workingMinutes', label: 'Worked (min)', render: (d) => (d.workingMinutes || '—') },
    {
      key: 'status',
      label: 'Status',
      render: (d) => (
        <span className="font-medium" style={{ color: STATUS_COLOR[d.status] ?? 'var(--foreground)' }}>
          {d.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => router.push('/ess/team')} className="text-xs font-medium hover:underline" style={{ color: 'var(--info)' }}>
            ← Back to My Team
          </button>
          <h1 className="mt-1 text-xl font-semibold" style={fg}>
            {data?.employee.name ?? 'Loading…'}
          </h1>
          <p className="text-sm" style={muted}>
            {data?.employee.employeeCode ?? ''}
            {data?.employee.designation ? ` · ${data.employee.designation}` : ''}
            {data?.employee.department ? ` · ${data.employee.department}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', ...fg }}
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', ...fg }}
          >
            {[now.getUTCFullYear(), now.getUTCFullYear() - 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {data && data.leaveByType.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.leaveByType.map((lt, i) => (
            <LeaveTypeKpiCard
              key={lt.leaveMasterId}
              name={lt.name}
              available={lt.available}
              total={lt.available + lt.used}
              color={leaveCardColor(i)}
            />
          ))}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.days ?? []}
        loading={loading}
        rowKey={(d) => d.id}
        emptyMessage={error ?? 'No attendance recorded for this month.'}
      />
    </div>
  );
}
