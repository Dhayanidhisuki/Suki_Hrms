'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface Resource { id: number; name: string; resourceType: string | null; quantity: number; status: string; venueId: number | null; serialNumber: string | null; }

const fields: FieldDef[] = [
  { name: 'name', label: 'Resource Name', type: 'text', required: true },
  { name: 'resourceType', label: 'Type', type: 'select', options: [{ label: 'Projector', value: 'PROJECTOR' }, { label: 'Laptop', value: 'LAPTOP' }, { label: 'Camera', value: 'CAMERA' }, { label: 'Microphone', value: 'MIC' }, { label: 'Lab Equipment', value: 'LAB' }, { label: 'Software License', value: 'SOFTWARE' }, { label: 'Other', value: 'OTHER' }] },
  { name: 'venueId', label: 'Venue ID', type: 'number' },
  { name: 'serialNumber', label: 'Serial / License No.', type: 'text' },
  { name: 'quantity', label: 'Quantity', type: 'number', defaultValue: 1 },
  { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Available', value: 'AVAILABLE' }, { label: 'Booked', value: 'BOOKED' }, { label: 'Maintenance', value: 'MAINTENANCE' }, { label: 'Retired', value: 'RETIRED' }] },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

export default function ResourcesPage() {
  const [records, setRecords] = useState<Resource[]>([]);
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
        const res = await fetch('/api/training-resources');
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
    const url = editingId ? `/api/training-resources/${editingId}` : '/api/training-resources';
    const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/training-resources/${id}`, { method: 'DELETE' });
    if (!res.ok) { setError((await res.json()).error ?? 'Delete failed'); return; }
    setRefresh((n) => n + 1);
  };

  const columns: Column<Resource>[] = [
    { key: 'name', label: 'Resource', sortable: true },
    { key: 'resourceType', label: 'Type', render: (r) => r.resourceType ?? '—' },
    { key: 'quantity', label: 'Qty' },
    { key: 'status', label: 'Status', render: (r) => r.status },
    { key: 'serialNumber', label: 'Serial', render: (r) => r.serialNumber ?? '—' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Resources</h1>
        <button onClick={() => { setEditingId(null); setInitialValues({}); setModalOpen(true); }} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90" style={{ backgroundColor: 'var(--accent)' }}>
          + Add Resource
        </button>
      </div>

      <KPIGrid columns={3}>
        <KPICard label="Resources" value={records.length} tone="info" />
        <KPICard label="Available" value={records.filter((r) => r.status === "AVAILABLE").length} tone="success" />
        <KPICard label="Booked" value={records.filter((r) => r.status === "BOOKED").length} tone="warning" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable columns={columns} data={records} loading={loading} onEdit={(row) => {
        setEditingId(row.id);
        setInitialValues({ name: row.name, resourceType: row.resourceType ?? '', venueId: row.venueId ?? '', serialNumber: row.serialNumber ?? '', quantity: row.quantity, status: row.status });
        setModalOpen(true);
      }} onDelete={(row) => setDeleteId(row.id)} />

      <FormModal
        title={editingId ? 'Edit Resource' : 'Add Resource'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Resource"
        message="Are you sure?"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
