/**
 * Reusable slab/rate CRUD page for Pattern E tables.
 * Handles versioned records with effectiveFrom/effectiveTo columns,
 * app-layer overlap validation error display, and deactivation (not soft-delete).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef } from '@/components/ui';

interface SlabRecord {
  id: number;
  code: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  [key: string]: unknown;
}

interface ApiResponse<T extends SlabRecord> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface SlabPageProps<T extends SlabRecord> {
  title: string;
  apiPath: string;
  fields: FieldDef[];
  columns: Column<T>[];
  itemLabel: string;
}

export default function SlabPage<T extends SlabRecord>({ title, apiPath, fields, columns, itemLabel }: SlabPageProps<T>) {
  const [records, setRecords] = useState<T[]>([]);
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
      const res = await fetch(`${apiPath}?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse<T> = await res.json();
      setRecords(json.data); setPagination(json.pagination);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unknown error'); }
    finally { setLoading(false); }
  }, [apiPath, page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = () => { setEditingId(null); setInitialValues({ isActive: true }); setModalOpen(true); };
  const handleEdit = (row: T) => {
    setEditingId(row.id);
    const vals: Record<string, string | number | boolean | undefined> = {};
    for (const f of fields) {
      vals[f.name] = row[f.name] !== undefined && row[f.name] !== null ? (row[f.name] as string | number | boolean) : (f.defaultValue ?? '');
    }
    setInitialValues(vals);
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload: Record<string, unknown> = { ...values };
    // Convert empty strings to null for optional fields
    for (const f of fields) {
      if (!f.required && payload[f.name] === '') payload[f.name] = null;
    }
    const url = editingId ? `${apiPath}/${editingId}` : apiPath;
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? 'Save failed'); }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`${apiPath}/${id}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); setError(err.error ?? 'Deactivate failed'); return; }
    fetchData();
  };

  // Add standard columns: effectiveFrom, effectiveTo, status
  const allColumns: Column<T>[] = [
    ...columns,
    {
      key: 'effectiveFrom',
      label: 'Effective From',
      render: (row: T) => new Date(row.effectiveFrom).toLocaleDateString(),
      className: 'whitespace-nowrap',
    },
    {
      key: 'effectiveTo',
      label: 'Effective To',
      render: (row: T) => row.effectiveTo ? new Date(row.effectiveTo).toLocaleDateString() : 'Current',
      className: 'whitespace-nowrap',
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row: T) => (
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
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h1>
        <button onClick={handleAdd} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}>+ Add {itemLabel}</button>
      </div>
      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}
      <DataTable columns={allColumns} data={records} pagination={pagination} loading={loading}
        searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} onPageChange={setPage}
        onEdit={handleEdit} onDelete={(row) => setDeleteId(row.id)} />
      <FormModal title={editingId ? `Edit ${itemLabel}` : `Add ${itemLabel}`} fields={fields}
        initialValues={initialValues} isOpen={modalOpen} onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit} submitLabel={editingId ? 'Update' : 'Create'} />
      <ConfirmDialog title={`Deactivate ${itemLabel}`} message={`Are you sure you want to deactivate this ${itemLabel.toLowerCase()}? This will set it as inactive.`}
        confirmLabel="Deactivate"
        isOpen={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}
