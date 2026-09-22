'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface Trainer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  isExternal: boolean;
  vendor: string | null;
  commercialRate: string | number | null;
}

const fields: FieldDef[] = [
  { name: 'name', label: 'Trainer Name', type: 'text', required: true },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'text' },
  { name: 'isExternal', label: 'External Trainer', type: 'checkbox' },
  { name: 'vendor', label: 'Vendor / Agency', type: 'text' },
  { name: 'commercialRate', label: 'Commercial Rate', type: 'number' },
  { name: 'contractDetails', label: 'Contract Details', type: 'textarea' },
];

export default function TrainersPage() {
  const [records, setRecords] = useState<Trainer[]>([]);
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
        const res = await fetch('/api/trainers?full=1');
        if (!res.ok) throw new Error('Failed to fetch');
        const json: Trainer[] = await res.json();
        if (mounted) setRecords(json);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [refresh]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({});
    setModalOpen(true);
  };

  const handleEdit = (row: Trainer) => {
    setEditingId(row.id);
    setInitialValues({
      name: row.name,
      email: row.email ?? '',
      phone: row.phone ?? '',
      isExternal: row.isExternal,
      vendor: row.vendor ?? '',
      commercialRate: row.commercialRate != null ? Number(row.commercialRate) : '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const url = editingId ? `/api/trainers/${editingId}` : '/api/trainers';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/trainers/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Delete failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const columns: Column<Trainer>[] = [
    { key: 'name', label: 'Trainer', sortable: true },
    { key: 'isExternal', label: 'Type', render: (r) => (r.isExternal ? 'External' : 'Internal') },
    { key: 'email', label: 'Email', render: (r) => r.email ?? '—' },
    { key: 'phone', label: 'Phone', render: (r) => r.phone ?? '—' },
    { key: 'vendor', label: 'Vendor', render: (r) => r.vendor ?? '—' },
    { key: 'commercialRate', label: 'Rate', render: (r) => (r.commercialRate != null ? `₹${Number(r.commercialRate).toLocaleString('en-IN')}` : '—') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Trainers & Mentors</h1>
        <button onClick={handleAdd} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90" style={{ backgroundColor: 'var(--accent)' }}>
          + Add Trainer
        </button>
      </div>

      <KPIGrid columns={3}>
        <KPICard label="Trainers" value={records.length} tone="info" />
        <KPICard label="Internal" value={records.filter((r) => !r.isExternal).length} tone="success" />
        <KPICard label="External" value={records.filter((r) => r.isExternal).length} tone="warning" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable columns={columns} data={records} loading={loading} onEdit={handleEdit} onDelete={(row) => setDeleteId(row.id)} />

      <FormModal
        title={editingId ? 'Edit Trainer' : 'Add Trainer'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Trainer"
        message="Are you sure you want to delete this trainer?"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
