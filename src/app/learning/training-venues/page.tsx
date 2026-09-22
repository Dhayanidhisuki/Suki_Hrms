'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface Venue {
  id: number;
  name: string;
  capacity: number | null;
  location: string | null;
  equipment: string | null;
}

const fields: FieldDef[] = [
  { name: 'name', label: 'Venue Name', type: 'text', required: true },
  { name: 'capacity', label: 'Capacity', type: 'number' },
  { name: 'location', label: 'Location', type: 'text' },
  { name: 'equipment', label: 'Equipment Available', type: 'textarea' },
];

export default function TrainingVenuesPage() {
  const [records, setRecords] = useState<Venue[]>([]);
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
        const res = await fetch('/api/training-venues?full=1');
        if (!res.ok) throw new Error('Failed to fetch');
        const json: Venue[] = await res.json();
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

  const handleEdit = (row: Venue) => {
    setEditingId(row.id);
    setInitialValues({
      name: row.name,
      capacity: row.capacity ?? '',
      location: row.location ?? '',
      equipment: row.equipment ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const url = editingId ? `/api/training-venues/${editingId}` : '/api/training-venues';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/training-venues/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Delete failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const columns: Column<Venue>[] = [
    { key: 'name', label: 'Venue', sortable: true },
    { key: 'location', label: 'Location', render: (r) => r.location ?? '—' },
    { key: 'capacity', label: 'Capacity', render: (r) => r.capacity ?? '—' },
    { key: 'equipment', label: 'Equipment', render: (r) => r.equipment ?? '—' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Venues</h1>
        <button onClick={handleAdd} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90" style={{ backgroundColor: 'var(--accent)' }}>
          + Add Venue
        </button>
      </div>

      <KPIGrid columns={2}>
        <KPICard label="Venues" value={records.length} tone="info" />
        <KPICard label="Total Capacity" value={records.reduce((s, r) => s + (r.capacity ?? 0), 0)} tone="success" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable columns={columns} data={records} loading={loading} onEdit={handleEdit} onDelete={(row) => setDeleteId(row.id)} />

      <FormModal
        title={editingId ? 'Edit Venue' : 'Add Venue'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Venue"
        message="Are you sure you want to delete this venue?"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
