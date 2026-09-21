'use client';

/**
 * Leave Masters — moved off the generic SimpleMasterPage once it needed a
 * field (defaultAnnualDays) none of the other 7 masters sharing that
 * component use. A +/- stepper for that field, everything else identical
 * to the generic simple-master modal it replaced.
 */

import { useState, useEffect, useCallback } from 'react';
import { DataTable, ConfirmDialog, type Column, KPICard, KPIGrid, useToast } from '@/components/ui';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';
import { useModuleStats } from '@/hooks/useModuleStats';

interface LeaveMaster {
  id: number;
  code: string;
  name: string;
  description: string | null;
  defaultAnnualDays: number;
  accrualType: 'FIXED_ANNUAL' | 'EARNED_PER_DAYS_WORKED' | 'MANUAL';
  daysWorkedPerAccrualUnit: number | null;
  carryForwardAllowed: boolean;
  carryForwardMaxDays: number | null;
  isActive: boolean;
  deletedAt: string | null;
}

interface ApiResponse { data: LeaveMaster[]; pagination: { page: number; limit: number; total: number; totalPages: number } }

function Stepper({ value, onChange, min = 0, max = 365 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        className="h-9 w-9 rounded-lg border text-lg font-medium leading-none"
        style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        aria-label="Decrease"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? 0 : clamp(Number(e.target.value)))}
        min={min}
        max={max}
        step="0.5"
        className="w-20 rounded-lg border px-3 py-2 text-sm text-center"
        style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        className="h-9 w-9 rounded-lg border text-lg font-medium leading-none"
        style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        aria-label="Increase"
      >
        +
      </button>
      <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>days / year</span>
    </div>
  );
}

export default function LeaveMastersPage() {
  const toast = useToast();
  const [records, setRecords] = useState<LeaveMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const { stats } = useModuleStats('leave-masters');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultAnnualDays, setDefaultAnnualDays] = useState(0);
  const [accrualType, setAccrualType] = useState<'FIXED_ANNUAL' | 'EARNED_PER_DAYS_WORKED' | 'MANUAL'>('FIXED_ANNUAL');
  const [daysWorkedPerAccrualUnit, setDaysWorkedPerAccrualUnit] = useState<number | ''>('');
  const [carryForwardAllowed, setCarryForwardAllowed] = useState(false);
  const [carryForwardMaxDays, setCarryForwardMaxDays] = useState<number | ''>('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [accrualYear, setAccrualYear] = useState(new Date().getFullYear());
  const [accrualRunning, setAccrualRunning] = useState(false);

  const runAccrual = async () => {
    setAccrualRunning(true);
    try {
      const res = await fetch('/api/workforce/leave/accrual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: accrualYear }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Accrual run failed');
      toast.success(
        `Credited ${data.employeesProcessed} employee(s) across ${data.leaveTypesProcessed} leave type(s) for ${data.year} — ${data.balancesWritten} balance row(s) written.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Accrual run failed');
    } finally {
      setAccrualRunning(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const res = await fetch(`/api/masters/leave-masters?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data);
      setPagination(json.pagination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, search, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingId(null);
    setCode('');
    setName('');
    setDescription('');
    setDefaultAnnualDays(0);
    setAccrualType('FIXED_ANNUAL');
    setDaysWorkedPerAccrualUnit('');
    setCarryForwardAllowed(false);
    setCarryForwardMaxDays('');
    setIsActive(true);
    setModalOpen(true);
  };

  const handleEdit = (row: LeaveMaster) => {
    setEditingId(row.id);
    setCode(row.code);
    setName(row.name);
    setDescription(row.description ?? '');
    setDefaultAnnualDays(row.defaultAnnualDays);
    setAccrualType(row.accrualType);
    setDaysWorkedPerAccrualUnit(row.daysWorkedPerAccrualUnit ?? '');
    setCarryForwardAllowed(row.carryForwardAllowed);
    setCarryForwardMaxDays(row.carryForwardMaxDays ?? '');
    setIsActive(row.isActive);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/leave-masters/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editingId ? `/api/masters/leave-masters/${editingId}` : '/api/masters/leave-masters';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          name,
          description: description || null,
          defaultAnnualDays,
          accrualType,
          daysWorkedPerAccrualUnit: accrualType === 'EARNED_PER_DAYS_WORKED' ? daysWorkedPerAccrualUnit || null : null,
          carryForwardAllowed,
          carryForwardMaxDays: carryForwardAllowed ? carryForwardMaxDays || null : null,
          isActive,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Save failed');
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<LeaveMaster>[] = [
    { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description', render: (row) => row.description ?? '—' },
    {
      key: 'accrual',
      label: 'Accrual',
      render: (row) =>
        row.accrualType === 'EARNED_PER_DAYS_WORKED'
          ? `1 day / ${row.daysWorkedPerAccrualUnit ?? '?'} worked`
          : row.accrualType === 'MANUAL'
            ? 'Manually credited'
            : `${Number(row.defaultAnnualDays)} / year`,
    },
    {
      key: 'carryForward',
      label: 'Carry Forward',
      render: (row) => (row.carryForwardAllowed ? (row.carryForwardMaxDays ? `up to ${Number(row.carryForwardMaxDays)}` : 'yes') : 'no'),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => (
        <span
          className="px-2 py-0.5 text-xs font-medium rounded-full"
          style={{ backgroundColor: row.isActive ? '#dcfce7' : '#fee2e2', color: row.isActive ? '#166534' : '#991b1b' }}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm';
  const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' };

  return (
    <div className="space-y-4">
      <MasterGroupTabs groupLabel="Workforce" />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Leave Masters</h1>
        <button
          onClick={handleAdd}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Leave Master
        </button>
      </div>

      {/* KPI Cards */}
      <KPIGrid columns={2}>
        <KPICard label="Total Leave Masters" value={stats.total} tone="info" />
        <KPICard label="Active" value={stats.active ?? 0} tone="success" />
      </KPIGrid>

      <div className="rounded-lg border p-4 space-y-2" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Annual Leave Credit</h2>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          Credits every active employee for the selected year — a fixed amount for &ldquo;Fixed amount every year&rdquo; leave types,
          or days-worked &divide; days-per-unit (rounded down) for &ldquo;Earned per days worked&rdquo; types. Safe to re-run; already
          availed/adjusted leave for the year is preserved.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="number"
            value={accrualYear}
            onChange={(e) => setAccrualYear(Number(e.target.value))}
            className="w-28 rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          />
          <button
            onClick={runAccrual}
            disabled={accrualRunning}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {accrualRunning ? 'Running…' : `Run Credit for ${accrualYear}`}
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={records}
        pagination={pagination}
        loading={loading}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        onPageChange={setPage}
        onEdit={handleEdit}
        onDelete={(row) => setDeleteId(row.id)}
      />

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-lg border p-5 space-y-4" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              {editingId ? 'Edit Leave Master' : 'Add Leave Master'}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Code *</label>
                <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} style={inputStyle} placeholder="e.g. SL" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} style={inputStyle} placeholder="e.g. Sick Leave" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>How is this leave credited? *</label>
              <select
                value={accrualType}
                onChange={(e) => setAccrualType(e.target.value as 'FIXED_ANNUAL' | 'EARNED_PER_DAYS_WORKED' | 'MANUAL')}
                className={inputClass}
                style={inputStyle}
              >
                <option value="FIXED_ANNUAL">Fixed amount every year</option>
                <option value="EARNED_PER_DAYS_WORKED">Earned per days worked</option>
                <option value="MANUAL">Manually credited only (e.g. Comp-Off)</option>
              </select>
            </div>

            {accrualType === 'FIXED_ANNUAL' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>How many days per year? *</label>
                <Stepper value={defaultAnnualDays} onChange={setDefaultAnnualDays} />
                <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  Credited in full each year the annual leave-credit run happens.
                </span>
              </div>
            )}

            {accrualType === 'EARNED_PER_DAYS_WORKED' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Days worked per 1 day earned *</label>
                <input
                  type="number"
                  min={1}
                  value={daysWorkedPerAccrualUnit}
                  onChange={(e) => setDaysWorkedPerAccrualUnit(e.target.value === '' ? '' : Number(e.target.value))}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="e.g. 20"
                />
                <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  e.g. Earned Leave at 1 day per 20 working days worked — the annual run sums each employee&apos;s present days for
                  the year and divides by this number.
                </span>
              </div>
            )}

            {accrualType === 'MANUAL' && (
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Not credited by the annual run — balance only changes when something explicitly grants it (e.g. OT worked on a
                weekly-off/holiday approved as Comp-Off instead of paid overtime).
              </p>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={carryForwardAllowed}
                onChange={(e) => setCarryForwardAllowed(e.target.checked)}
                className="h-4 w-4 rounded"
                style={{ accentColor: 'var(--accent)' }}
              />
              <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Unused balance carries forward to next year</span>
            </label>

            {carryForwardAllowed && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Max days to carry forward</label>
                <input
                  type="number"
                  min={0}
                  value={carryForwardMaxDays}
                  onChange={(e) => setCarryForwardMaxDays(e.target.value === '' ? '' : Number(e.target.value))}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Leave blank for uncapped"
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} style={inputStyle} rows={2} />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: 'var(--accent)' }} />
              <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Active</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg border px-4 py-2 text-sm font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !code || !name}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        title="Delete Leave Master"
        message="Are you sure you want to soft-delete this leave master? It will be marked inactive and hidden from lists."
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
