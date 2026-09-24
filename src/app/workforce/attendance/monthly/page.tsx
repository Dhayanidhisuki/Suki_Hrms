/**
 * Monthly Attendance — employee × date grid with status badges, KPI summary
 * cards, and filters (search, department, designation, employee type, status).
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { FormModal, useToast, type FieldDef, KPICard } from '@/components/ui';

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
  source: string | null;
  inSource: string | null;
  outSource: string | null;
}

interface EmployeeMonth {
  employeeId: number;
  employeeCode: string;
  oldEmployeeCode: string | null;
  name: string;
  department?: string | null;
  designation?: string | null;
  employeeType?: string | null;
  days: DayRecord[];
  summary: {
    status: 'OPEN' | 'FINALIZED' | 'FROZEN';
    reopenedAt: string | null;
    reopenedByName: string | null;
    reopenReason: string | null;
  } | null;
}

interface GridResponse {
  data: EmployeeMonth[];
  year: number;
  month: number;
}

interface MasterOption {
  id: number | string;
  name: string;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

function dayStatus(day: DayRecord | undefined): 'none' | 'present' | 'absent' | 'leave' | 'overtime' | 'early-out' | 'weekly-off' | 'holiday' | 'permission' | 'missing-punch' {
  if (!day) return 'none';
  if (day.status === 'WeeklyOff') return 'weekly-off';
  if (day.status === 'Holiday') return 'holiday';
  if (day.status === 'Leave') return 'leave';
  if (day.status === 'Permission') return 'permission';
  if (day.status === 'Absent' || day.workingMinutes === 0) return 'absent';
  if (day.status === 'MissingPunch') return 'missing-punch';
  if ((day.otMinutesApproved ?? day.otMinutesCalculated) > 0) return 'overtime';
  if (day.earlyOutMinutes > 0) return 'early-out';
  return 'present';
}

const statusConfig: Record<string, { label: string; bg: string; fg: string; icon: string }> = {
  present: { label: 'Present', bg: '#dcfce7', fg: '#166534', icon: '✓' },
  absent: { label: 'Absent', bg: '#fee2e2', fg: '#991b1b', icon: '✕' },
  leave: { label: 'Leave', bg: '#f3e8ff', fg: '#7e22ce', icon: 'L' },
  overtime: { label: 'Overtime', bg: '#e0e7ff', fg: '#3730a3', icon: 'OT' },
  'early-out': { label: 'Early Out', bg: '#ffedd5', fg: '#9a3412', icon: 'EO' },
  'weekly-off': { label: 'Weekly Off', bg: '#dbeafe', fg: '#1e40af', icon: 'WO' },
  holiday: { label: 'Holiday', bg: '#dbeafe', fg: '#1e40af', icon: 'HO' },
  permission: { label: 'Permission', bg: '#fef9c3', fg: '#854d0e', icon: 'P' },
  'missing-punch': { label: 'Missing Punch', bg: '#fee2e2', fg: '#991b1b', icon: 'MP' },
  none: { label: '—', bg: 'transparent', fg: 'var(--foreground-muted)', icon: '' },
};

function cellContent(status: ReturnType<typeof dayStatus>): { bg: string; fg: string; text: string } {
  const cfg = statusConfig[status];
  const s = dayShort(status);
  return { bg: cfg.bg, fg: cfg.fg, text: s };
}

function dayShort(status: string): string {
  switch (status) {
    case 'present':
      return 'P';
    case 'absent':
      return 'A';
    case 'leave':
      return 'L';
    case 'overtime':
      return 'OT';
    case 'early-out':
      return 'EO';
    case 'weekly-off':
      return 'WO';
    case 'holiday':
      return 'HO';
    case 'permission':
      return 'P';
    case 'missing-punch':
      return 'MP';
    default:
      return '';
  }
}

function cellTooltip(day: DayRecord | undefined, dateLabel: string): string {
  if (!day) return dateLabel;
  return [
    dateLabel,
    `Status: ${day.status}`,
    `In: ${formatTime(day.inTime)}  Out: ${formatTime(day.outTime)}`,
    `Late: ${day.lateMinutes}m  Early-Out: ${day.earlyOutMinutes}m`,
    `OT: ${day.otMinutesApproved ?? day.otMinutesCalculated}m`,
    day.source ? `Source: ${day.source === 'biometric+app' ? 'Biometric + App' : day.source === 'app' ? 'App' : day.source}` : '',
    day.remarks ? `Remarks: ${day.remarks}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function classNames(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

const now = new Date();

export default function MonthlyAttendancePage() {
  const toast = useToast();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<EmployeeMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  // Phase 18 — grid filters.
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departments, setDepartments] = useState<MasterOption[]>([]);
  const [designations, setDesignations] = useState<MasterOption[]>([]);
  const [employeeTypes, setEmployeeTypes] = useState<MasterOption[]>([]);

  const numDays = daysInMonth(year, month);
  const dayList = useMemo(() => Array.from({ length: numDays }, (_, i) => i + 1), [numDays]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce/attendance/monthly?year=${year}&month=${month}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: GridResponse = await res.json();
      setData(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [year, month, toast]);

  const fetchMasters = useCallback(async () => {
    try {
      const [dRes, des, tRes] = await Promise.all([
        fetch('/api/masters/departments?limit=500'),
        fetch('/api/masters/designations?limit=500'),
        fetch('/api/masters/employee-types?limit=500'),
      ]);
      if (dRes.ok) {
        const dJson = await dRes.json();
        setDepartments((dJson.data ?? dJson.items ?? dJson ?? []).map((x: { id: number; name: string }) => ({ id: x.id, name: x.name })));
      }
      if (des.ok) {
        const desJson = await des.json();
        setDesignations((desJson.data ?? desJson.items ?? desJson ?? []).map((x: { id: number; name: string }) => ({ id: x.id, name: x.name })));
      }
      if (tRes.ok) {
        const tJson = await tRes.json();
        setEmployeeTypes((tJson.data ?? tJson.items ?? tJson ?? []).map((x: { id: number; name: string }) => ({ id: x.id, name: x.name })));
      }
    } catch {
      // master filters are optional
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchMasters();
  }, [fetchData, fetchMasters]);

  const filteredData = useMemo(() => {
    return data.filter((emp) => {
      const term = search.trim().toLowerCase();
      if (term && !emp.employeeCode.toLowerCase().includes(term) && !emp.name.toLowerCase().includes(term) && !(emp.oldEmployeeCode ?? '').toLowerCase().includes(term)) return false;
      if (departmentFilter && emp.department !== departmentFilter) return false;
      if (designationFilter && emp.designation !== designationFilter) return false;
      if (typeFilter && emp.employeeType !== typeFilter) return false;
      if (statusFilter) {
        const match = emp.days.some((d) => dayStatus(d) === statusFilter);
        if (!match) return false;
      }
      return true;
    });
  }, [data, search, departmentFilter, designationFilter, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let earlyOut = 0;
    let overtime = 0;
    let leave = 0;
    for (const emp of filteredData) {
      for (const d of emp.days) {
        const s = dayStatus(d);
        if (s === 'present') present++;
        else if (s === 'absent') absent++;
        else if (s === 'early-out') earlyOut++;
        else if (s === 'overtime') overtime++;
        else if (s === 'leave') leave++;
      }
    }
    return {
      totalEmployees: filteredData.length,
      present,
      absent,
      earlyOut,
      overtime,
      leave,
    };
  }, [filteredData]);

  const monthStatus = data[0]?.summary?.status ?? 'OPEN';
  const reopenInfo = data.find((e) => e.summary?.reopenedAt)?.summary ?? null;

  const runAction = async (url: string, body: Record<string, unknown>, successMsg: string) => {
    setBusy(true);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Action failed');
      toast.success(json.message ?? successMsg);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const reopenFields: FieldDef[] = [{ name: 'reason', label: 'Reopen Reason', type: 'textarea', required: true }];

  const handleExport = () => {
    window.open(`/api/biometric/export?year=${year}&month=${month}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Monthly Attendance
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Track and manage employee attendance records
          </p>
        </div>
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
          {/* Phase 18 — filter and export controls */}
          <input
            type="text"
            placeholder="Search employee…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-40 rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="FINALIZED">Finalized</option>
            <option value="FROZEN">Frozen</option>
            <option value="READY_FOR_PAYROLL">Ready for Payroll</option>
          </select>
          <button
            onClick={handleExport}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Export CSV
          </button>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard label="Total Employees" value={stats.totalEmployees} tone="info" icon={<Icon.Users />} />
        <KPICard label="Present" value={stats.present} tone="success" icon={<Icon.Check />} />
        <KPICard label="Absent" value={stats.absent} tone="danger" icon={<Icon.X />} />
        <KPICard label="Early Out" value={stats.earlyOut} tone="warning" icon={<Icon.Clock />} />
        <KPICard label="Overtime" value={stats.overtime} tone="info" icon={<Icon.Briefcase />} />
        <KPICard label="Leave" value={stats.leave} tone="danger" icon={<Icon.Calendar />} />
      </div>

      {reopenInfo?.reopenedAt && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
          Reopened by <strong>{reopenInfo.reopenedByName ?? 'Unknown'}</strong> on {new Date(reopenInfo.reopenedAt).toLocaleString()}
          {reopenInfo.reopenReason ? <> — {reopenInfo.reopenReason}</> : null}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
            Search by code or name…
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          />
        </div>
        <FilterSelect label="Department" value={departmentFilter} onChange={setDepartmentFilter} options={departments} />
        <FilterSelect label="Designation" value={designationFilter} onChange={setDesignationFilter} options={designations} />
        <FilterSelect label="Type" value={typeFilter} onChange={setTypeFilter} options={employeeTypes} />
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-40 rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          >
            <option value="">All Status</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="leave">Leave</option>
            <option value="overtime">Overtime</option>
            <option value="early-out">Early Out</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <table className="text-xs">
          <thead>
            <tr style={{ backgroundColor: 'var(--surface-hover)' }}>
              <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>
                S.No
              </th>
              <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>
                Employee Code
              </th>
              <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>
                Ref Code
              </th>
              <th className="sticky left-0 z-10 px-3 py-2 text-left font-medium" style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--foreground-muted)' }}>
                Employee Name
              </th>
              <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--foreground-muted)' }}>
                Department
              </th>
              {dayList.map((d) => (
                <th key={d} className="px-2 py-2 text-center font-medium" style={{ color: 'var(--foreground-muted)', minWidth: 34 }}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={numDays + 5} className="px-4 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
                  Loading...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={numDays + 5} className="px-4 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
                  No employees found.
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={numDays + 4} className="px-4 py-8 text-center" style={{ color: 'var(--foreground-muted)' }}>
                  No employees match the current filters.
                </td>
              </tr>
            ) : (
              filteredData.map((emp, idx) => {
                const byDate = new Map(emp.days.map((d) => [d.date.slice(0, 10), d]));
                return (
                  <tr key={emp.employeeId} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="whitespace-nowrap px-3 py-1.5" style={{ color: 'var(--foreground-muted)' }}>
                      {idx + 1}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5" style={{ color: 'var(--foreground)' }}>
                      {emp.oldEmployeeCode ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5" style={{ color: 'var(--foreground-muted)' }}>
                      {emp.employeeCode}
                    </td>
                    <td className="sticky left-0 z-10 whitespace-nowrap px-3 py-1.5" style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}>
                      <Link
                        href={`/workforce/attendance/overview?employeeId=${emp.employeeId}&year=${year}&month=${month}`}
                        title="Open day-by-day overview"
                        className="hover:underline"
                      >
                        {emp.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5" style={{ color: 'var(--foreground-muted)' }}>
                      {emp.department ?? '—'}
                    </td>
                    {dayList.map((d) => {
                      const iso = isoDate(year, month, d);
                      const day = byDate.get(iso);
                      const status = dayStatus(day);
                      const { bg, fg, text } = cellContent(status);
                      return (
                        <td
                          key={d}
                          title={cellTooltip(day, iso)}
                          className="px-1 py-1.5 text-center"
                          style={{ backgroundColor: bg, color: fg, minWidth: 34 }}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-xs" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <span className="font-medium" style={{ color: 'var(--foreground)' }}>Legend:</span>
        {Object.entries(statusConfig)
          .filter(([key]) => key !== 'none')
          .map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold" style={{ backgroundColor: cfg.bg, color: cfg.fg }}>
                {cfg.icon}
              </span>
              <span style={{ color: 'var(--foreground-muted)' }}>{cfg.label}</span>
            </div>
          ))}
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

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: MasterOption[];
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-40 rounded-lg border px-3 py-2 text-sm"
        style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
      >
        <option value="">All {label}s</option>
        {options.map((o) => (
          <option key={o.id} value={o.name}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// Minimal inline icon set used by KPICard
function IconBox({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-5 w-5 items-center justify-center">{children}</span>;
}

const Icon = {
  Users: () => <IconBox>👥</IconBox>,
  Check: () => <IconBox>✓</IconBox>,
  X: () => <IconBox>✕</IconBox>,
  Clock: () => <IconBox>⏰</IconBox>,
  Briefcase: () => <IconBox>💼</IconBox>,
  Calendar: () => <IconBox>📅</IconBox>,
};
