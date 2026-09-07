'use client';

/**
 * Shift Rotation Plans — an ordered weekly cycle of shifts (e.g. Shift 1 ->
 * Shift 2 -> Shift 3 -> back to Shift 1), anchored to a real calendar date.
 * Assigned to an employee via Employee > Job Profile > Shift Assignment =
 * Rotational; the actual shift for any given day is computed from this plan
 * (see resolveEmployeeShiftConfig in src/lib/biometricConversion.ts), not
 * stored per-day.
 *
 * Doesn't reuse the generic FormModal pattern the other masters use — the
 * ordered shift list needs its own add/remove/reorder UI, which a flat form
 * can't express.
 */

import { useState, useEffect, useCallback } from 'react';
import { DataTable, SearchableSelect, ConfirmDialog, type Column } from '@/components/ui';

interface ShiftRef {
  id: number;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface Slot {
  id: number;
  sequenceOrder: number;
  shiftMasterId: number;
  shiftMaster: ShiftRef;
}

interface RotationPlan {
  id: number;
  code: string;
  name: string;
  anchorDate: string;
  description: string | null;
  isActive: boolean;
  slots: Slot[];
}

interface ApiResponse { data: RotationPlan[]; pagination: { page: number; limit: number; total: number; totalPages: number } }

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function ShiftRotationPlansPage() {
  const [records, setRecords] = useState<RotationPlan[]>([]);
  const [shiftOptions, setShiftOptions] = useState<ShiftRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [anchorDate, setAnchorDate] = useState(todayIso());
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [cycle, setCycle] = useState<number[]>([]); // ordered shiftMasterIds
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const [plansRes, shiftsRes] = await Promise.all([
        fetch(`/api/masters/shift-rotation-plans?${params}`),
        fetch('/api/masters/shift-masters?limit=500'),
      ]);
      if (!plansRes.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await plansRes.json();
      setRecords(json.data);
      setPagination(json.pagination);
      if (shiftsRes.ok) {
        const shiftsJson: { data: ShiftRef[] } = await shiftsRes.json();
        setShiftOptions(shiftsJson.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingId(null);
    setCode('');
    setName('');
    setAnchorDate(todayIso());
    setDescription('');
    setIsActive(true);
    setCycle([]);
    setSaveError(null);
    setModalOpen(true);
  };

  const handleEdit = (row: RotationPlan) => {
    setEditingId(row.id);
    setCode(row.code);
    setName(row.name);
    setAnchorDate(row.anchorDate.slice(0, 10));
    setDescription(row.description ?? '');
    setIsActive(row.isActive);
    setCycle(row.slots.map((s) => s.shiftMasterId));
    setSaveError(null);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/shift-rotation-plans/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  const handleSave = async () => {
    setSaveError(null);
    if (cycle.length < 2) {
      setSaveError('Add at least 2 shifts to the rotation cycle.');
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/masters/shift-rotation-plans/${editingId}` : '/api/masters/shift-rotation-plans';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, anchorDate, description: description || null, isActive, shiftMasterIds: cycle }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Save failed');
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const shiftLabel = (id: number) => {
    const s = shiftOptions.find((o) => o.id === id);
    return s ? `${s.code} — ${s.name} (${s.startTime}-${s.endTime})` : `#${id}`;
  };

  const columns: Column<RotationPlan>[] = [
    { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
    { key: 'name', label: 'Name' },
    { key: 'anchorDate', label: 'Anchor Date', render: (row) => row.anchorDate.slice(0, 10) },
    {
      key: 'slots',
      label: 'Weekly Cycle',
      render: (row) => row.slots.map((s) => s.shiftMaster.code).join(' → ') || '—',
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Shift Rotation Plans</h1>
        <button
          onClick={handleAdd}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Rotation Plan
        </button>
      </div>
      <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
        Defines a weekly shift cycle (e.g. Shift 1 → Shift 2 → Shift 3 → back to Shift 1). Assign it to an employee via Employees &gt; Job
        Profile &gt; Shift Assignment = Rotational — the applicable shift for any day is calculated automatically from the anchor date.
      </p>
      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}
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
          <div
            className="w-full max-w-lg rounded-lg border p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              {editingId ? 'Edit Rotation Plan' : 'Add Rotation Plan'}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Code *</label>
                <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} style={inputStyle} placeholder="e.g. ROT-3W" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} style={inputStyle} placeholder="e.g. 3-Week Rotation" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Anchor Date *</label>
              <input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} className={inputClass} style={inputStyle} />
              <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                The week containing this date uses the first shift below; the cycle repeats every week after that.
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Weekly Cycle * (in order)</label>
              {cycle.map((shiftId, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs w-14" style={{ color: 'var(--foreground-muted)' }}>Week {idx + 1}</span>
                  <div className="flex-1">
                    <SearchableSelect
                      value={shiftId}
                      options={shiftOptions.map((s) => ({ label: `${s.code} — ${s.name} (${s.startTime}-${s.endTime})`, value: s.id }))}
                      onChange={(v) => setCycle((prev) => prev.map((id, i) => (i === idx ? Number(v) : id)))}
                    />
                  </div>
                  <button
                    onClick={() => setCycle((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-sm px-2 py-1 rounded"
                    style={{ color: '#dc2626' }}
                    aria-label={`Remove week ${idx + 1}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => setCycle((prev) => [...prev, shiftOptions[0]?.id ?? 0])}
                disabled={shiftOptions.length === 0}
                className="rounded-lg border px-3 py-2 text-sm font-medium self-start disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                + Add week to cycle
              </button>
              {cycle.length > 0 && (
                <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  Preview: {cycle.map(shiftLabel).join(' → ')} → (repeats)
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} style={inputStyle} rows={2} />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: 'var(--accent)' }} />
              <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Active</span>
            </label>

            {saveError && (
              <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                {saveError}
              </div>
            )}

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
        title="Delete Rotation Plan"
        message="Are you sure you want to soft-delete this rotation plan?"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
