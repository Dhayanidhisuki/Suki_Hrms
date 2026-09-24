'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTable, FormModal, ConfirmDialog, useToast, type Column, type FieldDef, StatusPillTabs, KPICard, KPIGrid } from '@/components/ui';
import { CalendarClock, CircleCheck, Clock3, Download } from 'lucide-react';
import { useModuleStats } from '@/hooks/useModuleStats';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';

interface ShiftMaster {
  id: number; code: string; name: string; startTime: string; endTime: string;
  graceMinutes: number;
  nightAllowed: boolean;
  bufferMinutes: number;
  snacksAllowed: boolean;
  mealsAllowed: boolean;
  snacksMealsDurationMinutes: number | null;
  breakMinutes: number;
  nightAllowanceAmount: number | null;
  nightAllowanceFromHour: number | null;
  snacksAllowanceAmount: number | null;
  foodAllowanceAmount: number | null;
  mealsAllowanceAmount: number | null;
  description: string | null; isActive: boolean; deletedAt: string | null;
}

interface ApiResponse { data: ShiftMaster[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }

/**
 * Stable per-shift badge colour — hashed from the code so General/Morning/
 * Evening/Night (or whatever a company names its shifts) each get a
 * consistent, distinct colour without anyone maintaining a code→colour map.
 * Uses the app's own tone tokens, not Stitch's literal palette, so it still
 * themes correctly across accents and dark mode.
 */
const CODE_TONES = ['info', 'warning', 'success', 'accent', 'danger'] as const;
function codeTone(code: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  const tone = CODE_TONES[h % CODE_TONES.length];
  return { bg: `var(--${tone}-soft)`, fg: `var(--${tone})` };
}

const baseFields: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. General Shift' },
  { name: 'startTime', label: 'Start Time', type: 'text', required: true, placeholder: '09:00', helpText: 'HH:mm format' },
  { name: 'endTime', label: 'End Time', type: 'text', required: true, placeholder: '18:00', helpText: 'HH:mm format' },
  { name: 'graceMinutes', label: 'Grace Minutes', type: 'number', defaultValue: 0, min: 0 },
  { name: 'bufferMinutes', label: 'Buffer Minutes', type: 'number', defaultValue: 0, min: 0, helpText: 'Extra minutes tolerated beyond the shift window.' },
  { name: 'breakMinutes', label: 'Break Minutes', type: 'number', defaultValue: 0, min: 0, helpText: 'Lunch/tea break deducted from working duration.' },
  { name: 'nightAllowed', label: 'Night Allowed', type: 'checkbox', defaultValue: false, helpText: 'This shift qualifies for night-shift allowance.' },
  { name: 'nightAllowanceAmount', label: 'Night Allowance Amount', type: 'number', min: 0, step: '0.01', helpText: 'Flat amount per day when night allowance applies.' },
  { name: 'snacksAllowed', label: 'Snacks Allowed', type: 'checkbox', defaultValue: false },
  { name: 'snacksAllowanceAmount', label: 'Snacks Allowance Amount', type: 'number', min: 0, step: '0.01', helpText: 'Flat amount per day when snacks allowance applies.' },
  { name: 'mealsAllowed', label: 'Meals Allowed', type: 'checkbox', defaultValue: false },
  { name: 'mealsAllowanceAmount', label: 'Meals Allowance Amount', type: 'number', min: 0, step: '0.01', helpText: 'Flat amount per day when meals allowance applies.' },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
];

export default function ShiftMastersPage() {
  const toast = useToast();
  const { stats } = useModuleStats('shift-masters');
  const [records, setRecords] = useState<ShiftMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Server-side: the list is paginated, so a client-side filter would only
  // hide rows on the current page and misreport the total.
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fields: FieldDef[] = useMemo(() => {
    if (editingId) {
      return [{ name: 'code', label: 'Shift Code', type: 'text', disabled: true, helpText: 'Generated automatically' } as FieldDef, ...baseFields];
    }
    return baseFields;
  }, [editingId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      });
      const res = await fetch(`/api/masters/shift-masters?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data); setPagination(json.pagination);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Unknown error'); }
    finally { setLoading(false); }
  }, [page, search, status, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = () => { setEditingId(null); setInitialValues({ isActive: true, graceMinutes: 0, breakMinutes: 0 }); setModalOpen(true); };
  const handleEdit = (row: ShiftMaster) => {
    setEditingId(row.id);
    setInitialValues({
      code: row.code,
      name: row.name,
      startTime: row.startTime,
      endTime: row.endTime,
      graceMinutes: row.graceMinutes,
      bufferMinutes: row.bufferMinutes,
      breakMinutes: row.breakMinutes,
      nightAllowed: row.nightAllowed,
      nightAllowanceAmount: row.nightAllowanceAmount ?? '',
      nightAllowanceFromHour: row.nightAllowanceFromHour ?? '',
      snacksAllowed: row.snacksAllowed,
      snacksAllowanceAmount: row.snacksAllowanceAmount ?? '',
      mealsAllowed: row.mealsAllowed,
      mealsAllowanceAmount: row.mealsAllowanceAmount ?? '',
      foodAllowanceAmount: row.foodAllowanceAmount ?? '',
      snacksMealsDurationMinutes: row.snacksMealsDurationMinutes ?? '',
      description: row.description ?? '',
      isActive: row.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload = { ...values, description: values.description || null };
    const url = editingId ? `/api/masters/shift-masters/${editingId}` : '/api/masters/shift-masters';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? 'Save failed'); }
    fetchData();
    toast.success(editingId ? 'Shift updated successfully.' : 'Shift created successfully.');
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/shift-masters/${id}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); toast.error(err.error ?? 'Delete failed'); return; }
    fetchData();
    toast.success('Shift deleted successfully.');
  };

  const handleExportCsv = useCallback(() => {
    if (records.length === 0) {
      toast.warning('Nothing to export for the current filters');
      return;
    }
    const headers = [
      'Shift Code', 'Name', 'Start', 'End', 'Grace (min)', 'Buffer (min)', 'Break (min)',
      'Night Allowed', 'Snacks Allowed', 'Meals Allowed', 'Status',
    ];
    const cell = (v: string | number | boolean | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = records.map((r) => [
      cell(r.code), cell(r.name), cell(r.startTime), cell(r.endTime),
      cell(r.graceMinutes), cell(r.bufferMinutes), cell(r.breakMinutes),
      cell(r.nightAllowed ? 'Yes' : 'No'), cell(r.snacksAllowed ? 'Yes' : 'No'), cell(r.mealsAllowed ? 'Yes' : 'No'),
      cell(r.isActive ? 'Active' : 'Inactive'),
    ].join(','));
    const blob = new Blob(['\ufeff' + [headers.map(cell).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shift-masters-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${records.length} row${records.length === 1 ? '' : 's'}`);
  }, [records, toast]);

  const columns: Column<ShiftMaster>[] = [
    {
      key: 'code',
      label: 'Shift Code',
      sortable: true,
      render: (row) => (
        <span
          className="inline-block rounded-md px-2 py-1 font-mono text-xs font-semibold tracking-wide"
          style={{ backgroundColor: codeTone(row.code).bg, color: codeTone(row.code).fg }}
        >
          {row.code}
        </span>
      ),
    },
    { key: 'name', label: 'Name' },
    { key: 'startTime', label: 'Start' },
    { key: 'endTime', label: 'End' },
    {
      key: 'duration',
      label: 'Shift Hours',
      render: (row) => {
        const parseTime = (t: string) => {
          const [h, m] = t.split(':');
          const hours = Number(h || 0);
          const mins = m ? Number(m) : 0;
          return { hours, mins, isNaN: Number.isNaN(hours) || Number.isNaN(mins) };
        };
        const start = parseTime(row.startTime);
        const end = parseTime(row.endTime);
        if (start.isNaN || end.isNaN) {
          return <span style={{ color: 'var(--foreground-muted)' }}>—</span>;
        }
        let startMinutes = start.hours * 60 + start.mins;
        let endMinutes = end.hours * 60 + end.mins;
        if (endMinutes <= startMinutes) endMinutes += 24 * 60;
        const totalMinutes = endMinutes - startMinutes;
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        const decimals = (totalMinutes / 60).toFixed(2);
        return (
          <span title={`${totalMinutes} minutes`}>
            {h}h {m}m <span style={{ color: 'var(--foreground-muted)' }}>({decimals} hrs)</span>
          </span>
        );
      },
    },
    { key: 'graceMinutes', label: 'Grace (min)' },
    { key: 'bufferMinutes', label: 'Buffer (min)' },
    {
      key: 'allowances',
      label: 'Allowances',
      render: (row) => {
        const tags = [
          row.nightAllowed && 'Night',
          row.snacksAllowed && 'Snacks',
          row.mealsAllowed && 'Meals',
        ].filter(Boolean) as string[];
        if (tags.length === 0) return <span style={{ color: 'var(--foreground-muted)' }}>—</span>;
        return (
          <span className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span key={t} className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>
                {t}
              </span>
            ))}
            {row.snacksMealsDurationMinutes ? ` (${row.snacksMealsDurationMinutes} min)` : ''}
          </span>
        );
      },
    },
    { key: 'description', label: 'Description', render: (row) => row.description ?? '—' },
    {
      key: 'isActive', label: 'Status',
      render: (row) => (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full"
          style={{ backgroundColor: row.isActive ? 'var(--success-soft)' : 'var(--danger-soft)', color: row.isActive ? 'var(--success)' : 'var(--danger)' }}>
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <MasterGroupTabs groupLabel="Workforce" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Shift Masters</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Configure work schedules, operating windows, grace periods, and shift allowance rules.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={handleExportCsv} className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium shadow-sm transition hover:opacity-80"
            style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
          <button onClick={handleAdd} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}>+ Add Shift Master</button>
        </div>
      </div>

      <KPIGrid columns={3}>
        <KPICard
          label="Configured Shifts"
          value={stats.total}
          tone="info"
          icon={<CalendarClock />}
          subtitle={typeof stats.custom?.shiftNames === 'string' && stats.custom.shiftNames ? stats.custom.shiftNames : undefined}
        />
        <KPICard
          label="24-Hour Coverage"
          value={`${stats.custom?.coveragePct ?? 0}%`}
          tone={Number(stats.custom?.coveragePct ?? 0) >= 100 ? 'success' : 'warning'}
          icon={<CircleCheck />}
          subtitle={
            Number(stats.custom?.coveragePct ?? 0) >= 100
              ? 'Active shifts span the full day'
              : 'Gaps exist in the daily shift window'
          }
        />
        <KPICard
          label="Avg Shift Duration"
          value={`${stats.custom?.avgShiftHours ?? 0}h ${stats.custom?.avgShiftMinutes ?? 0}m`}
          tone="accent"
          icon={<Clock3 />}
          subtitle="Across active shift definitions"
        />
      </KPIGrid>

      <DataTable columns={columns} data={records} pagination={pagination} loading={loading}
        filtersLead
        filters={
          <StatusPillTabs
            items={[
              { value: '', label: 'All' },
              { value: 'active', label: 'Active', tone: 'success' },
              { value: 'inactive', label: 'Inactive', tone: 'neutral' },
            ]}
            value={status}
            onChange={(v) => { setStatus(v as '' | 'active' | 'inactive'); setPage(1); }}
            idPrefix="shift-masters-status"
          />
        }
        searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} onPageChange={setPage}
        onEdit={handleEdit} onDelete={(row) => setDeleteId(row.id)} />
      <FormModal title={editingId ? 'Edit Shift Master' : 'Add Shift Master'} fields={fields}
        initialValues={initialValues} isOpen={modalOpen} onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit} submitLabel={editingId ? 'Update' : 'Create'} />
      <ConfirmDialog title="Delete Shift Master" message="Are you sure you want to soft-delete this shift master?"
        isOpen={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}
