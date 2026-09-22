'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

// §9: Training Method master — delivery/mode classification.
interface Method { id: number; code: string | null; name: string; delivery: string | null; mode: string | null; description: string | null; isActive: boolean; }

const fields: FieldDef[] = [
  { name: 'code', label: 'Method Code', type: 'text', placeholder: 'e.g. CLS, E-LRN' },
  { name: 'name', label: 'Method Name', type: 'text', required: true },
  { name: 'delivery', label: 'Delivery', type: 'select', options: ['INTERNAL', 'EXTERNAL'].map((v) => ({ label: v, value: v })) },
  { name: 'mode', label: 'Mode', type: 'select', options: ['ONLINE', 'OFFLINE', 'BLENDED'].map((v) => ({ label: v, value: v })) },
  { name: 'description', label: 'Description', type: 'textarea' },
];

export default function MethodsPage() {
  const [records, setRecords] = useState<Method[]>([]);
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
        const res = await fetch('/api/training-methods');
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
    const url = editingId ? `/api/training-methods/${editingId}` : '/api/training-methods';
    const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/training-methods/${id}`, { method: 'DELETE' });
    if (!res.ok) { setError((await res.json()).error ?? 'Delete failed'); return; }
    setRefresh((n) => n + 1);
  };

  const columns: Column<Method>[] = [
    { key: 'code', label: 'Code', render: (r) => r.code ?? '—' },
    { key: 'name', label: 'Method', sortable: true },
    { key: 'delivery', label: 'Delivery', render: (r) => r.delivery ?? '—' },
    { key: 'mode', label: 'Mode', render: (r) => r.mode ?? '—' },
    { key: 'isActive', label: 'Active', render: (r) => (r.isActive ? 'Yes' : 'No') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Methods</h1>
        <button onClick={() => { setEditingId(null); setInitialValues({}); setModalOpen(true); }} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90" style={{ backgroundColor: 'var(--accent)' }}>
          + Add Method
        </button>
      </div>

      <KPIGrid columns={3}>
        <KPICard label="Methods" value={records.length} tone="info" />
        <KPICard label="Internal" value={records.filter((r) => r.delivery === 'INTERNAL').length} tone="info" />
        <KPICard label="Online" value={records.filter((r) => r.mode === 'ONLINE').length} tone="success" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable columns={columns} data={records} loading={loading} onEdit={(row) => {
        setEditingId(row.id);
        setInitialValues({ code: row.code ?? '', name: row.name, delivery: row.delivery ?? '', mode: row.mode ?? '', description: row.description ?? '' });
        setModalOpen(true);
      }} onDelete={(row) => setDeleteId(row.id)} />

      <FormModal
        title={editingId ? 'Edit Method' : 'Add Method'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Method"
        message="Are you sure?"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
