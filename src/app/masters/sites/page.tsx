/**
 * Site Master (KUN BRD review, 2026-09-10) — the physical location an
 * employee reports to. Kept separate from Unit (the legal/org entity,
 * relabelled "Branch / Unit"), per the client's own wording. Pattern B:
 * simple master + FK (companyId), mirrors masters/units/page.tsx.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef, type FieldOption } from '@/components/ui';

interface Site {
  id: number;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  companyId: number;
  isActive: boolean;
  deletedAt: string | null;
  company: { id: number; name: string } | null;
}

interface ApiResponse {
  data: Site[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function SitesPage() {
  const [records, setRecords] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [companyOptions, setCompanyOptions] = useState<FieldOption[]>([]);

  useEffect(() => {
    fetch('/api/masters/companies?limit=100')
      .then((r) => r.json())
      .then((json: { data: { id: number; name: string }[] }) =>
        setCompanyOptions(json.data.map((c) => ({ label: c.name, value: c.id })))
      );
  }, []);

  const fields: FieldDef[] = [
    { name: 'companyId', label: 'Company', type: 'select', required: true, options: companyOptions },
    { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. SITE1' },
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Chennai — Block A' },
    { name: 'address', label: 'Address', type: 'textarea', placeholder: 'Optional' },
    { name: 'city', label: 'City', type: 'text', placeholder: 'Optional' },
    { name: 'state', label: 'State', type: 'text', placeholder: 'Optional' },
    { name: 'pinCode', label: 'PIN Code', type: 'text', placeholder: 'Optional' },
    { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const res = await fetch(`/api/masters/sites?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data);
      setPagination(json.pagination);
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
    setInitialValues({ isActive: true });
    setModalOpen(true);
  };

  const handleEdit = (row: Site) => {
    setEditingId(row.id);
    setInitialValues({
      code: row.code,
      name: row.name,
      address: row.address ?? '',
      city: row.city ?? '',
      state: row.state ?? '',
      pinCode: row.pinCode ?? '',
      companyId: row.companyId,
      isActive: row.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload = {
      ...values,
      address: values.address || null,
      city: values.city || null,
      state: values.state || null,
      pinCode: values.pinCode || null,
    };
    const url = editingId ? `/api/masters/sites/${editingId}` : '/api/masters/sites';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/sites/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  const columns: Column<Site>[] = [
    { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
    { key: 'name', label: 'Name' },
    { key: 'company', label: 'Company', render: (row) => row.company?.name ?? '—' },
    {
      key: 'location',
      label: 'Location',
      render: (row) => [row.city, row.state].filter(Boolean).join(', ') || '—',
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Site Master
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Physical locations. Distinct from Branch / Unit (the legal/organisational entity).
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Site
        </button>
      </div>

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
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onPageChange={setPage}
        onEdit={handleEdit}
        onDelete={(row) => setDeleteId(row.id)}
      />

      <FormModal
        title={editingId ? 'Edit Site' : 'Add Site'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Site"
        message="Are you sure you want to soft-delete this site? It will be marked inactive and hidden from lists."
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
