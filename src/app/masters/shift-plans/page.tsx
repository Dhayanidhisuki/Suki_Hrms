'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef, type FieldOption } from '@/components/ui';

interface ShiftPlan {
  id: number; code: string; name: string; shiftMasterId: number;
  startTime: string | null; endTime: string | null; description: string | null;
  isActive: boolean; deletedAt: string | null;
  shiftMaster: { id: number; name: string; code: string };
}

interface ApiResponse { data: ShiftPlan[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }

export default function ShiftPlansPage() {
  const [records, setRecords] = useState<ShiftPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [shiftOptions, setShiftOptions] = useState<FieldOption[]>([]);

  useEffect(() => {
    fetch('/api/masters/shift-masters?limit=100')
      .then((r) => r.json())
      .then((json: { data: { id: number; name: string }[] }) => setShiftOptions(json.data.map((s) => ({ label: s.name, value: s.id }))));
  }, []);

  const fields: FieldDef[] = [
    { name: 'shiftMasterId', label: 'Shift Master', type: 'select', required: true, options: shiftOptions },
    { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. GEN-PLAN1' },
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. General Plan A' },
    { name: 'startTime', label: 'Start Time Override', type: 'text', placeholder: 'Leave blank to inherit', helpText: 'HH:mm — leave blank to use shift master default' },
    { name: 'endTime', label: 'End Time Override', type: 'text', placeholder: 'Leave blank to inherit', helpText: 'HH:mm — leave blank to use shift master default' },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional' },
    { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const res = await fetch(`/api/masters/shift-plans?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data); setPagination(json.pagination);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unknown error'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = () => { setEditingId(null); setInitialValues({ isActive: true }); setModalOpen(true); };
  const handleEdit = (row: ShiftPlan) => {
    setEditingId(row.id);
    setInitialValues({ code: row.code, name: row.name, shiftMasterId: row.shiftMasterId, startTime: row.startTime ?? '', endTime: row.endTime ?? '', description: row.description ?? '', isActive: row.isActive });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload = {
      ...values,
      description: values.description || null,
      startTime: values.startTime || null,
      endTime: values.endTime || null,
    };
    const url = editingId ? `/api/masters/shift-plans/${editingId}` : '/api/masters/shift-plans';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? 'Save failed'); }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/shift-plans/${id}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); setError(err.error ?? 'Delete failed'); return; }
    fetchData();
  };

  const columns: Column<ShiftPlan>[] = [
    { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
    { key: 'name', label: 'Name' },
    { key: 'shiftMaster', label: 'Shift Master', render: (row) => row.shiftMaster?.name ?? '—' },
    { key: 'startTime', label: 'Start Override', render: (row) => row.startTime ?? '—' },
    { key: 'endTime', label: 'End Override', render: (row) => row.endTime ?? '—' },
    {
      key: 'isActive', label: 'Status',
      render: (row) => (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full"
          style={{ backgroundColor: row.isActive ? '#dcfce7' : '#fee2e2', color: row.isActive ? '#166534' : '#991b1b' }}>
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Shift Plans</h1>
        <button onClick={handleAdd} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}>+ Add Shift Plan</button>
      </div>
      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}
      <DataTable columns={columns} data={records} pagination={pagination} loading={loading}
        searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} onPageChange={setPage}
        onEdit={handleEdit} onDelete={(row) => setDeleteId(row.id)} />
      <FormModal title={editingId ? 'Edit Shift Plan' : 'Add Shift Plan'} fields={fields}
        initialValues={initialValues} isOpen={modalOpen} onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit} submitLabel={editingId ? 'Update' : 'Create'} />
      <ConfirmDialog title="Delete Shift Plan" message="Are you sure you want to soft-delete this shift plan?"
        isOpen={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}
