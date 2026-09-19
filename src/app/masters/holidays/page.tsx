/**
 * Holiday Master — three tabs:
 * 1. Declared Holidays (existing holiday calendar)
 * 2. Department Weekly Off (Mon-Sun buttons per department, freeze/unfreeze)
 * 3. Yearly Leave Calendar (calendar view with color-coded leave types)
 *
 * UI pass (2026-09): shared Tabs/SectionCard/Alert primitives, department
 * weekly-off rendered as a searchable list of day-chip rows, calendar with
 * year jump + month grid + colored day cells. Endpoints/fields unchanged.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DataTable, FormModal, ConfirmDialog, PageHeader, Alert, StatusBadge, SectionCard, Tabs, Button, EmptyState, KPICard, KPIGrid, useToast,
  type Column, type FieldDef,
} from '@/components/ui';

// ─── Shared types ───────────────────────────────────────────────────────

type HolidayType = 'COMPANY' | 'FESTIVAL' | 'GOVERNMENT' | 'OTHER';

interface Holiday {
  id: number;
  date: string;
  name: string;
  holidayType: HolidayType;
  description: string | null;
  companyId: number;
  isActive: boolean;
  deletedAt: string | null;
  company: { id: number; name: string } | null;
}

interface Department {
  id: number;
  code: string;
  name: string;
}

interface DepartmentWeeklyOff {
  id: number;
  departmentId: number;
  weekOffDay: number;
  isFrozen: boolean;
  department: { id: number; code: string; name: string };
}

interface LeaveType {
  id: number;
  code: string;
  name: string;
  color: string;
  description: string | null;
  isActive: boolean;
}

interface YearlyLeaveEntry {
  id: number;
  date: string;
  name: string;
  description: string | null;
  leaveTypeMaster: { id: number; code: string; name: string; color: string };
}

// ─── Constants ──────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Render order Mon→Sun (the API stores 0=Sunday … 6=Saturday). */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const HOLIDAY_TYPE_OPTIONS: { label: string; value: HolidayType }[] = [
  { label: 'Company', value: 'COMPANY' },
  { label: 'Festival', value: 'FESTIVAL' },
  { label: 'Government', value: 'GOVERNMENT' },
  { label: 'Other', value: 'OTHER' },
];

const HOLIDAY_TYPE_TONE: Record<HolidayType, 'accent' | 'warning' | 'danger' | 'neutral'> = {
  COMPANY: 'accent',
  FESTIVAL: 'warning',
  GOVERNMENT: 'danger',
  OTHER: 'neutral',
};

const inputCls = 'rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2';
const inputStyle = { backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;

// ─── Tab 1: Declared Holidays ───────────────────────────────────────────

function DeclaredHolidaysTab() {
  const toast = useToast();
  const [records, setRecords] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Holidays are scoped to the signed-in company by the API; there is no
  // company picker because a user must never write another company's calendar.
  const fields: FieldDef[] = [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Diwali' },
    { name: 'holidayType', label: 'Holiday Type', type: 'select', required: true, options: HOLIDAY_TYPE_OPTIONS, defaultValue: 'OTHER' },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional' },
    { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const res = await fetch(`/api/masters/holidays?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const resp = await res.json();
      setRecords(resp.data);
      setPagination(resp.pagination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, search, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({ isActive: true, holidayType: 'OTHER' });
    setModalOpen(true);
  };

  const handleEdit = (row: Holiday) => {
    setEditingId(row.id);
    setInitialValues({
      date: row.date.slice(0, 10),
      name: row.name,
      holidayType: row.holidayType,
      description: row.description ?? '',
      isActive: row.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload = { ...values, description: values.description || null };
    const url = editingId ? `/api/masters/holidays/${editingId}` : '/api/masters/holidays';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/holidays/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  const columns: Column<Holiday>[] = [
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      render: (row) => {
        const d = new Date(row.date);
        return (
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md leading-none" style={{ backgroundColor: 'var(--surface-muted)' }}>
              <span className="text-[9px] font-semibold uppercase" style={{ color: 'var(--foreground-muted)' }}>{d.toLocaleDateString(undefined, { month: 'short' })}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>{d.getUTCDate()}</span>
            </div>
            <div className="leading-tight">
              <div className="text-xs tabular-nums">{d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })}</div>
              <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{d.toLocaleDateString(undefined, { weekday: 'long' })}</div>
            </div>
          </div>
        );
      },
    },
    { key: 'name', label: 'Name', className: 'font-medium' },
    {
      key: 'holidayType',
      label: 'Type',
      render: (row) => <StatusBadge tone={HOLIDAY_TYPE_TONE[row.holidayType] ?? 'neutral'} dot>{HOLIDAY_TYPE_OPTIONS.find((o) => o.value === row.holidayType)?.label ?? row.holidayType}</StatusBadge>,
    },
    { key: 'company', label: 'Company', render: (row) => row.company?.name ?? '—' },
    { key: 'description', label: 'Description', render: (row) => <span style={{ color: row.description ? undefined : 'var(--foreground-muted)' }}>{row.description ?? '—'}</span> },
    { key: 'isActive', label: 'Status', render: (row) => <StatusBadge tone={row.isActive ? 'success' : 'danger'} dot>{row.isActive ? 'Active' : 'Inactive'}</StatusBadge> },
  ];

  return (
    <SectionCard
      title="Declared Holidays"
      description="Declared holidays feed the OT Approval weekly-off/holiday Comp-Off choice and the Attendance Overview day status."
      count={loading ? undefined : pagination.total}
      actions={<Button variant="primary" size="sm" onClick={handleAdd}>+ Add Holiday</Button>}
      flush
    >
      <DataTable
        variant="card"
        columns={columns}
        data={records}
        pagination={pagination}
        loading={loading}
        searchValue={search}
        searchPlaceholder="Search holidays…"
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        onPageChange={setPage}
        onEdit={handleEdit}
        onDelete={(row) => setDeleteId(row.id)}
        emptyMessage="No holidays declared yet."
      />
      <FormModal title={editingId ? 'Edit Holiday' : 'Add Holiday'} fields={fields} initialValues={initialValues} isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} submitLabel={editingId ? 'Update' : 'Create'} />
      <ConfirmDialog title="Delete Holiday" message="Are you sure you want to soft-delete this holiday?" isOpen={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </SectionCard>
  );
}

// ─── Tab 2: Department Weekly Off ───────────────────────────────────────

function DepartmentWeeklyOffTab() {
  const toast = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [configs, setConfigs] = useState<DepartmentWeeklyOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, configRes] = await Promise.all([
        fetch('/api/masters/departments?limit=100'),
        fetch('/api/masters/department-weekly-off'),
      ]);
      const deptJson = await deptRes.json();
      const configJson = await configRes.json();
      setDepartments(deptJson.data ?? []);
      setConfigs(configJson.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleDay = async (deptId: number, day: number) => {
    setBusyKey(`${deptId}-${day}`);
    try {
      const res = await fetch('/api/masters/department-weekly-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId: deptId, weekOffDay: day, isFrozen: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Failed to toggle');
        return;
      }
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusyKey(null);
    }
  };

  const removeDay = async (id: number, deptId: number, day: number) => {
    setBusyKey(`${deptId}-${day}`);
    try {
      const res = await fetch('/api/masters/department-weekly-off', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Failed to remove');
        return;
      }
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusyKey(null);
    }
  };

  const configByDept = useMemo(() => {
    const m = new Map<number, DepartmentWeeklyOff[]>();
    for (const c of configs) {
      if (!m.has(c.departmentId)) m.set(c.departmentId, []);
      m.get(c.departmentId)!.push(c);
    }
    return m;
  }, [configs]);

  const filteredDepts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? departments.filter((d) => `${d.code} ${d.name}`.toLowerCase().includes(q)) : departments;
  }, [departments, search]);

  const configuredCount = configByDept.size;

  return (
    <div className="space-y-4">
      <KPIGrid columns={3}>
        <KPICard label="Departments" value={departments.length} tone="info" />
        <KPICard label="With Weekly Off Set" value={configuredCount} tone="success" />
        <KPICard label="Using Default (Sunday)" value={Math.max(0, departments.length - configuredCount)} subtitle="no config → Sunday" tone={departments.length - configuredCount > 0 ? 'warning' : 'success'} />
      </KPIGrid>

      <SectionCard
        title="Department Weekly Off"
        description="Click a day to freeze it as the weekly off for that department. Employees who work on a frozen day get OT and can claim comp-off."
        count={loading ? undefined : filteredDepts.length}
        flush
        actions={
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter departments…"
            className="w-48 rounded-lg border px-3 py-1.5 text-xs focus:outline-none focus:ring-2"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          />
        }
      >
        {/* Column headers */}
        <div className="hidden items-center gap-3 border-b px-4 py-2 md:flex" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-hover)' }}>
          <div className="w-64 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>Department</div>
          <div className="grid flex-1 grid-cols-7 gap-1.5">
            {DAY_ORDER.map((d) => (
              <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wide" style={{ color: d === 0 || d === 6 ? 'var(--foreground-muted)' : 'var(--foreground-muted)' }}>{DAYS_OF_WEEK[d]}</div>
            ))}
          </div>
          <div className="w-48 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>Effective weekly off</div>
        </div>

        {loading ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
        ) : filteredDepts.length === 0 ? (
          <EmptyState title="No departments" description={search ? 'No department matches your filter.' : 'Create departments in the Department master first.'} />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {filteredDepts.map((dept) => {
              const deptConfigs = configByDept.get(dept.id) ?? [];
              const daysSet = new Set(deptConfigs.map((c) => c.weekOffDay));
              return (
                <li key={dept.id} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center" style={{ borderColor: 'var(--border)' }}>
                  <div className="w-64 min-w-0 leading-tight">
                    <div className="truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>{dept.name}</div>
                    <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{dept.code}</div>
                  </div>

                  <div className="grid flex-1 grid-cols-7 gap-1.5">
                    {DAY_ORDER.map((day) => {
                      const cfg = deptConfigs.find((c) => c.weekOffDay === day);
                      const active = !!cfg;
                      const busy = busyKey === `${dept.id}-${day}`;
                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={busy}
                          onClick={() => (active ? removeDay(cfg!.id, dept.id, day) : toggleDay(dept.id, day))}
                          className="flex h-9 flex-col items-center justify-center rounded-md border text-[11px] font-semibold transition hover:brightness-95 disabled:opacity-50"
                          style={{
                            backgroundColor: active ? 'var(--warning)' : 'var(--surface)',
                            color: active ? '#1f1400' : 'var(--foreground)',
                            borderColor: active ? 'var(--warning)' : 'var(--border)',
                          }}
                          title={active ? `Frozen — click to remove ${FULL_DAYS[day]} as weekly off` : `Click to set ${FULL_DAYS[day]} as weekly off`}
                          aria-pressed={active}
                        >
                          <span className="md:hidden">{DAYS_OF_WEEK[day]}</span>
                          <span className="hidden md:inline">{active ? '✓' : DAYS_OF_WEEK[day].charAt(0)}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="w-48">
                    {daysSet.size > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {DAY_ORDER.filter((d) => daysSet.has(d)).map((d) => (
                          <StatusBadge key={d} tone="warning" dot>{FULL_DAYS[d]}</StatusBadge>
                        ))}
                      </div>
                    ) : (
                      <StatusBadge tone="neutral" title="No configuration — falls back to Sunday">Default · Sunday</StatusBadge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Tab 3: Yearly Leave Calendar ────────────────────────────────────────

function YearlyLeaveCalendarTab() {
  const toast = useToast();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [entries, setEntries] = useState<YearlyLeaveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [month, setMonth] = useState(new Date().getUTCMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState<number | null>(null);
  const [entryName, setEntryName] = useState('');
  const [ltModalOpen, setLtModalOpen] = useState(false);
  const [ltForm, setLtForm] = useState({ code: '', name: '', color: '#3b82f6', description: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ltRes, calRes] = await Promise.all([
        fetch('/api/masters/leave-types'),
        fetch(`/api/masters/yearly-leave-calendar?year=${year}`),
      ]);
      const ltJson = await ltRes.json();
      const calJson = await calRes.json();
      setLeaveTypes(ltJson.data ?? []);
      setEntries(calJson.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [year, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const entryMap = useMemo(() => {
    const m = new Map<string, YearlyLeaveEntry>();
    entries.forEach((e) => m.set(e.date.slice(0, 10), e));
    return m;
  }, [entries]);

  const countByType = useMemo(() => {
    const m = new Map<number, number>();
    entries.forEach((e) => m.set(e.leaveTypeMaster.id, (m.get(e.leaveTypeMaster.id) ?? 0) + 1));
    return m;
  }, [entries]);

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDayOfMonth = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const calendarDays: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);
  const todayStr = new Date().toISOString().slice(0, 10);

  const monthEntries = useMemo(
    () => entries.filter((e) => { const d = new Date(e.date); return d.getUTCFullYear() === year && d.getUTCMonth() === month; }),
    [entries, year, month],
  );

  const handleDateClick = (day: number | null) => {
    if (day === null) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const existing = entryMap.get(dateStr);
    setSelectedDate(dateStr);
    setSelectedLeaveTypeId(existing?.leaveTypeMaster.id ?? leaveTypes[0]?.id ?? null);
    setEntryName(existing?.name ?? '');
  };

  const handleSaveEntry = async () => {
    if (!selectedDate || !selectedLeaveTypeId || !entryName) return;
    setSaving(true);
    try {
      const res = await fetch('/api/masters/yearly-leave-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, leaveTypeMasterId: selectedLeaveTypeId, name: entryName }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Failed to save');
        return;
      }
      toast.success(`Saved leave entry for ${new Date(selectedDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`);
      setSelectedDate(null);
      setEntryName('');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (id: number) => {
    try {
      const res = await fetch('/api/masters/yearly-leave-calendar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Failed to delete');
        return;
      }
      toast.success('Leave entry deleted');
      setSelectedDate(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleCreateLeaveType = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/masters/leave-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ltForm),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Failed to create leave type');
        return;
      }
      toast.success(`Leave type "${ltForm.name}" created`);
      setLtModalOpen(false);
      setLtForm({ code: '', name: '', color: '#3b82f6', description: '' });
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const goPrevMonth = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); };
  const goNextMonth = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); };
  const navBtn = 'inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm transition hover:brightness-95';
  const selectedEntry = selectedDate ? entryMap.get(selectedDate) : undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        {/* Calendar */}
        <SectionCard flush>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <button onClick={() => setYear(year - 1)} className={navBtn} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }} aria-label="Previous year">«</button>
              <button onClick={goPrevMonth} className={navBtn} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }} aria-label="Previous month">‹</button>
              <span className="min-w-[170px] text-center text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{MONTH_NAMES[month]} {year}</span>
              <button onClick={goNextMonth} className={navBtn} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }} aria-label="Next month">›</button>
              <button onClick={() => setYear(year + 1)} className={navBtn} style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }} aria-label="Next year">»</button>
              <Button size="sm" onClick={() => { const n = new Date(); setYear(n.getUTCFullYear()); setMonth(n.getUTCMonth()); }}>Today</Button>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge tone="accent">{entries.length} leave days in {year}</StatusBadge>
              <Button variant="primary" size="sm" onClick={() => setLtModalOpen(true)}>+ Leave Type</Button>
            </div>
          </div>

          {loading ? (
            <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading calendar…</div>
          ) : (
            <div className="p-3">
              <div className="grid grid-cols-7 gap-1.5">
                {DAYS_OF_WEEK.map((d, i) => (
                  <div key={d} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide" style={{ color: i === 0 || i === 6 ? 'var(--danger)' : 'var(--foreground-muted)' }}>{d}</div>
                ))}
                {calendarDays.map((day, idx) => {
                  if (day === null) return <div key={`e${idx}`} className="h-20 rounded-lg" style={{ backgroundColor: 'var(--surface-muted)', opacity: 0.5 }} />;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const entry = entryMap.get(dateStr);
                  const isToday = dateStr === todayStr;
                  const dow = idx % 7;
                  const isWeekend = dow === 0 || dow === 6;
                  const color = entry?.leaveTypeMaster.color;
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => handleDateClick(day)}
                      title={entry ? `${entry.name} · ${entry.leaveTypeMaster.name}` : 'Click to mark as yearly leave'}
                      className="group relative flex h-20 flex-col rounded-lg border p-1.5 text-left transition hover:shadow-md"
                      style={{
                        backgroundColor: color ? `${color}1f` : isWeekend ? 'var(--surface-muted)' : 'var(--surface)',
                        borderColor: isToday ? 'var(--accent)' : color ? `${color}66` : 'var(--border)',
                        boxShadow: isToday ? '0 0 0 1px var(--accent) inset' : undefined,
                      }}
                    >
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
                        style={{
                          backgroundColor: isToday ? 'var(--accent)' : 'transparent',
                          color: isToday ? '#fff' : isWeekend && !color ? 'var(--danger)' : 'var(--foreground)',
                        }}
                      >
                        {day}
                      </span>
                      {entry && (
                        <span className="mt-auto flex items-center gap-1 overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-tight" style={{ backgroundColor: color, color: '#fff' }}>
                          <span className="truncate">{entry.name}</span>
                        </span>
                      )}
                      {!entry && (
                        <span className="mt-auto hidden text-[10px] group-hover:block" style={{ color: 'var(--foreground-muted)' }}>+ add</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Side panel: legend + month list */}
        <div className="space-y-4">
          <SectionCard title="Leave Types" description="Each type has its own colour on the calendar." count={leaveTypes.length}>
            {leaveTypes.length === 0 ? (
              <EmptyState compact title="No leave types yet" description="Create one to start marking dates." action={<Button size="sm" variant="primary" onClick={() => setLtModalOpen(true)}>+ Leave Type</Button>} />
            ) : (
              <ul className="space-y-2">
                {leaveTypes.map((lt) => (
                  <li key={lt.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ backgroundColor: lt.color }} />
                      <div className="min-w-0 leading-tight">
                        <div className="truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>{lt.name}</div>
                        <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{lt.code}{lt.description ? ` · ${lt.description}` : ''}</div>
                      </div>
                    </div>
                    <StatusBadge color={lt.color}>{countByType.get(lt.id) ?? 0} days</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title={`${MONTH_NAMES[month]} ${year}`} description="Leave entries in the selected month." count={monthEntries.length} flush>
            {monthEntries.length === 0 ? (
              <EmptyState compact title="No leave this month" description="Click a date on the calendar to add one." />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {monthEntries.map((e) => {
                  const d = new Date(e.date);
                  return (
                    <li key={e.id} className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md text-white leading-none" style={{ backgroundColor: e.leaveTypeMaster.color }}>
                          <span className="text-[9px] font-semibold uppercase opacity-90">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                          <span className="text-sm font-bold tabular-nums">{d.getUTCDate()}</span>
                        </div>
                        <div className="min-w-0 leading-tight">
                          <div className="truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>{e.name}</div>
                          <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{e.leaveTypeMaster.name}</div>
                        </div>
                      </div>
                      <Button variant="ghost" size="xs" onClick={() => handleDeleteEntry(e.id)} style={{ color: 'var(--danger)' }}>Delete</Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Date entry modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="w-full max-w-md space-y-4 rounded-xl border p-5 shadow-xl" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{selectedEntry ? 'Edit Leave Day' : 'Mark Leave Day'}</h2>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--foreground-muted)' }}>
                {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Leave Type</label>
              {leaveTypes.length === 0 ? (
                <Alert tone="warning">Create a leave type first using “+ Leave Type”.</Alert>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {leaveTypes.map((lt) => {
                    const active = lt.id === selectedLeaveTypeId;
                    return (
                      <button
                        key={lt.id}
                        type="button"
                        onClick={() => setSelectedLeaveTypeId(lt.id)}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition"
                        style={{
                          borderColor: active ? lt.color : 'var(--border)',
                          backgroundColor: active ? `${lt.color}1f` : 'var(--surface)',
                          boxShadow: active ? `0 0 0 1px ${lt.color} inset` : 'none',
                        }}
                      >
                        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: lt.color }} />
                        <span className="min-w-0 leading-tight">
                          <span className="block truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>{lt.name}</span>
                          <span className="block text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{lt.code}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Name</label>
              <input type="text" value={entryName} onChange={(e) => setEntryName(e.target.value)} placeholder="e.g. Independence Day" className={inputCls} style={inputStyle} autoFocus />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              {selectedEntry ? (
                <Button variant="ghost" size="sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteEntry(selectedEntry.id)}>Remove</Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button onClick={() => { setSelectedDate(null); setEntryName(''); }}>Cancel</Button>
                <Button variant="primary" loading={saving} disabled={!selectedLeaveTypeId || !entryName} onClick={handleSaveEntry}>Save</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leave type create modal */}
      {ltModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="w-full max-w-sm space-y-4 rounded-xl border p-5 shadow-xl" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>New Leave Type</h2>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Code</label>
                <input type="text" value={ltForm.code} onChange={(e) => setLtForm({ ...ltForm, code: e.target.value.toUpperCase() })} placeholder="NH" className={inputCls} style={inputStyle} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Name</label>
                <input type="text" value={ltForm.name} onChange={(e) => setLtForm({ ...ltForm, name: e.target.value })} placeholder="National Holiday" className={inputCls} style={inputStyle} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Colour</label>
              <div className="flex items-center gap-3">
                <input type="color" value={ltForm.color} onChange={(e) => setLtForm({ ...ltForm, color: e.target.value })} className="h-10 w-14 cursor-pointer rounded-lg border p-1" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }} />
                <div className="flex flex-wrap gap-1.5">
                  {['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'].map((c) => (
                    <button key={c} type="button" onClick={() => setLtForm({ ...ltForm, color: c })} className="h-6 w-6 rounded-full border-2 transition hover:scale-110" style={{ backgroundColor: c, borderColor: ltForm.color === c ? 'var(--foreground)' : 'transparent' }} aria-label={c} />
                  ))}
                </div>
                <StatusBadge color={ltForm.color}>{ltForm.name || 'Preview'}</StatusBadge>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Description (optional)</label>
              <input type="text" value={ltForm.description} onChange={(e) => setLtForm({ ...ltForm, description: e.target.value })} className={inputCls} style={inputStyle} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button onClick={() => setLtModalOpen(false)}>Cancel</Button>
              <Button variant="primary" loading={saving} disabled={!ltForm.code || !ltForm.name} onClick={handleCreateLeaveType}>Create</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page with tabs ────────────────────────────────────────────────

type HolidayTab = 'holidays' | 'weeklyOff' | 'leaveCalendar';

export default function HolidaysPage() {
  const [tab, setTab] = useState<HolidayTab>('holidays');

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Masters · Time Office"
        title="Holiday Master"
        description="Declared holidays, department-wise weekly offs and the colour-coded yearly leave calendar — all of which drive attendance status, OT eligibility and comp-off."
      />

      <Tabs<HolidayTab>
        tabs={[
          { key: 'holidays', label: 'Declared Holidays' },
          { key: 'weeklyOff', label: 'Department Weekly Off' },
          { key: 'leaveCalendar', label: 'Yearly Leave Calendar' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'holidays' && <DeclaredHolidaysTab />}
      {tab === 'weeklyOff' && <DepartmentWeeklyOffTab />}
      {tab === 'leaveCalendar' && <YearlyLeaveCalendarTab />}
    </div>
  );
}
