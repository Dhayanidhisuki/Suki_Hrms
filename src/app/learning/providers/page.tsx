'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface Provider { id: number; name: string; contactName: string | null; email: string | null; phone: string | null; categories: string | null; rating: string | number | null; }

const fields: FieldDef[] = [
  { name: 'name', label: 'Provider Name', type: 'text', required: true },
  { name: 'contactName', label: 'Contact Person', type: 'text' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'text' },
  { name: 'website', label: 'Website', type: 'text' },
  { name: 'categories', label: 'Categories Offered', type: 'text' },
  { name: 'rating', label: 'Rating (0-5)', type: 'number' },
  { name: 'address', label: 'Address', type: 'textarea' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

export default function ProvidersPage() {
  const [records, setRecords] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/training-providers');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (mounted) setRecords(Array.isArray(json) ? json : json.data ?? []);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [refresh]);

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const url = editingId ? `/api/training-providers/${editingId}` : '/api/training-providers';
    const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/training-providers/${id}`, { method: 'DELETE' });
    if (!res.ok) { setError((await res.json()).error ?? 'Delete failed'); return; }
    setRefresh((n) => n + 1);
  };

  const columns: Column<Provider>[] = [
    { key: 'name', label: 'Provider', sortable: true },
    { key: 'contactName', label: 'Contact', render: (r) => r.contactName ?? '—' },
    { key: 'email', label: 'Email', render: (r) => r.email ?? '—' },
    { key: 'categories', label: 'Categories', render: (r) => r.categories ?? '—' },
    { key: 'rating', label: 'Rating', render: (r) => (r.rating != null ? Number(r.rating).toFixed(1) : '—') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Providers</h1>
        <button onClick={() => { setEditingId(null); setInitialValues({}); setModalOpen(true); }} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90" style={{ backgroundColor: 'var(--accent)' }}>
          + Add Provider
        </button>
      </div>

      <KPIGrid columns={2}>
        <KPICard label="Providers" value={records.length} tone="info" />
        <KPICard label="Rated 4+" value={records.filter((r) => Number(r.rating) >= 4).length} tone="success" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable columns={columns} data={records} loading={loading} onEdit={(row) => {
        setEditingId(row.id);
        setInitialValues({ name: row.name, contactName: row.contactName ?? '', email: row.email ?? '', phone: row.phone ?? '', categories: row.categories ?? '', rating: row.rating != null ? Number(row.rating) : '' });
        setModalOpen(true);
      }} onDelete={(row) => setDeleteId(row.id)} />

      <FormModal
        title={editingId ? 'Edit Provider' : 'Add Provider'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Provider"
        message="Are you sure?"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
