'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef } from '@/components/ui';

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

const fields: FieldDef[] = [
  { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. GEN' },
  { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. General Shift' },
  { name: 'startTime', label: 'Start Time', type: 'text', required: true, placeholder: '09:00', helpText: 'HH:mm format' },
  { name: 'endTime', label: 'End Time', type: 'text', required: true, placeholder: '18:00', helpText: 'HH:mm format' },
  { name: 'graceMinutes', label: 'Grace Minutes', type: 'number', defaultValue: 0, min: 0 },
  { name: 'bufferMinutes', label: 'Buffer Minutes', type: 'number', defaultValue: 0, min: 0, helpText: 'Extra minutes tolerated beyond the shift window.' },
  { name: 'breakMinutes', label: 'Break Minutes', type: 'number', defaultValue: 0, min: 0, helpText: 'Lunch/tea break deducted from working duration.' },
  { name: 'nightAllowed', label: 'Night Allowed', type: 'checkbox', defaultValue: false, helpText: 'This shift qualifies for night-shift allowance.' },
  { name: 'nightAllowanceAmount', label: 'Night Allowance Amount', type: 'number', min: 0, step: '0.01', helpText: 'Flat amount per day when night allowance applies.' },
  { name: 'nightAllowanceFromHour', label: 'Night Allowance From Hour', type: 'number', min: 0, max: 23, helpText: 'Hour after which night allowance applies (e.g. 22 = 10 PM).' },
  { name: 'snacksAllowed', label: 'Snacks Allowed', type: 'checkbox', defaultValue: false },
  { name: 'snacksAllowanceAmount', label: 'Snacks Allowance Amount', type: 'number', min: 0, step: '0.01', helpText: 'Flat amount per day when snacks allowance applies.' },
  { name: 'mealsAllowed', label: 'Meals Allowed', type: 'checkbox', defaultValue: false },
  { name: 'mealsAllowanceAmount', label: 'Meals Allowance Amount', type: 'number', min: 0, step: '0.01', helpText: 'Flat amount per day when meals allowance applies.' },
  { name: 'foodAllowanceAmount', label: 'Food Allowance Amount', type: 'number', min: 0, step: '0.01', helpText: 'Flat amount per day for food allowance.' },
  { name: 'snacksMealsDurationMinutes', label: 'Snacks/Meals Duration (min)', type: 'number', min: 0, placeholder: 'e.g. 30' },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
];

export default function ShiftMastersPage() {
  const [records, setRecords] = useState<ShiftMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const res = await fetch(`/api/masters/shift-masters?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data); setPagination(json.pagination);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unknown error'); }
    finally { setLoading(false); }
  }, [page, search]);

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
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/shift-masters/${id}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); setError(err.error ?? 'Delete failed'); return; }
    fetchData();
  };

  const columns: Column<ShiftMaster>[] = [
    { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
    { key: 'name', label: 'Name' },
    { key: 'startTime', label: 'Start' },
    { key: 'endTime', label: 'End' },
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
          style={{ backgroundColor: row.isActive ? '#dcfce7' : '#fee2e2', color: row.isActive ? '#166534' : '#991b1b' }}>
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Shift Masters</h1>
        <button onClick={handleAdd} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}>+ Add Shift Master</button>
      </div>
      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}
      <DataTable columns={columns} data={records} pagination={pagination} loading={loading}
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
