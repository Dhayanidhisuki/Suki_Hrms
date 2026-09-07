'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef } from '@/components/ui';

interface DropdownItem {
  id: number; category: string; label: string; value: string;
  sortOrder: number; isActive: boolean; deletedAt: string | null;
}

interface ApiResponse { data: DropdownItem[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }

const fields: FieldDef[] = [
  { name: 'category', label: 'Category', type: 'text', required: true, placeholder: 'e.g. gender, blood_group' },
  { name: 'label', label: 'Label', type: 'text', required: true, placeholder: 'Display text' },
  { name: 'value', label: 'Value', type: 'text', required: true, placeholder: 'Stored value' },
  { name: 'sortOrder', label: 'Sort Order', type: 'number', defaultValue: 0, min: 0 },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
];

export default function DropdownMasterPage() {
  const [records, setRecords] = useState<DropdownItem[]>([]);
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
      const res = await fetch(`/api/masters/dropdown-master?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data); setPagination(json.pagination);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unknown error'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = () => { setEditingId(null); setInitialValues({ isActive: true, sortOrder: 0 }); setModalOpen(true); };
  const handleEdit = (row: DropdownItem) => {
    setEditingId(row.id);
    setInitialValues({ category: row.category, label: row.label, value: row.value, sortOrder: row.sortOrder, isActive: row.isActive });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const url = editingId ? `/api/masters/dropdown-master/${editingId}` : '/api/masters/dropdown-master';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? 'Save failed'); }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/dropdown-master/${id}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); setError(err.error ?? 'Delete failed'); return; }
    fetchData();
  };

  const columns: Column<DropdownItem>[] = [
    { key: 'category', label: 'Category', sortable: true, className: 'font-medium' },
    { key: 'label', label: 'Label' },
    { key: 'value', label: 'Value' },
    { key: 'sortOrder', label: 'Sort' },
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
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Dropdown Master</h1>
        <button onClick={handleAdd} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}>+ Add Dropdown Item</button>
      </div>
      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}
      <DataTable columns={columns} data={records} pagination={pagination} loading={loading}
        searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} onPageChange={setPage}
        onEdit={handleEdit} onDelete={(row) => setDeleteId(row.id)} />
      <FormModal title={editingId ? 'Edit Dropdown Item' : 'Add Dropdown Item'} fields={fields}
        initialValues={initialValues} isOpen={modalOpen} onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit} submitLabel={editingId ? 'Update' : 'Create'} />
      <ConfirmDialog title="Delete Dropdown Item" message="Are you sure you want to soft-delete this dropdown item?"
        isOpen={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}
