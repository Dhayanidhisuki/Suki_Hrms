'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface Mentor { id: number; name: string; role: string | null; expertise: string | null; email: string | null; phone: string | null; startDate: string | null; endDate: string | null; }

const fields: FieldDef[] = [
  { name: 'name', label: 'Mentor Name', type: 'text', required: true },
  { name: 'employeeId', label: 'Employee ID (internal)', type: 'number' },
  { name: 'role', label: 'Mentor Role', type: 'select', options: [{ label: 'Buddy', value: 'Buddy' }, { label: 'Coach', value: 'Coach' }, { label: 'SME', value: 'SME' }] },
  { name: 'expertise', label: 'Expertise', type: 'text' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'text' },
  { name: 'startDate', label: 'Start Date', type: 'date' },
  { name: 'endDate', label: 'End Date', type: 'date' },
  { name: 'expectedOutcome', label: 'Expected Outcome', type: 'text' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

export default function MentorsPage() {
  const [records, setRecords] = useState<Mentor[]>([]);
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
        const res = await fetch('/api/training-mentors');
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
    const url = editingId ? `/api/training-mentors/${editingId}` : '/api/training-mentors';
    const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/training-mentors/${id}`, { method: 'DELETE' });
    if (!res.ok) { setError((await res.json()).error ?? 'Delete failed'); return; }
    setRefresh((n) => n + 1);
  };

  const columns: Column<Mentor>[] = [
    { key: 'name', label: 'Mentor', sortable: true },
    { key: 'role', label: 'Role', render: (r) => r.role ?? '—' },
    { key: 'expertise', label: 'Expertise', render: (r) => r.expertise ?? '—' },
    { key: 'email', label: 'Email', render: (r) => r.email ?? '—' },
    { key: 'endDate', label: 'Active Until', render: (r) => (r.endDate ? r.endDate.slice(0, 10) : '—') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Mentors</h1>
        <button onClick={() => { setEditingId(null); setInitialValues({}); setModalOpen(true); }} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90" style={{ backgroundColor: 'var(--accent)' }}>
          + Add Mentor
        </button>
      </div>

      <KPIGrid columns={2}>
        <KPICard label="Mentors" value={records.length} tone="info" />
        <KPICard label="Active" value={records.filter((r) => !r.endDate || new Date(r.endDate) >= new Date()).length} tone="success" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable columns={columns} data={records} loading={loading} onEdit={(row) => {
        setEditingId(row.id);
        setInitialValues({ name: row.name, role: row.role ?? '', expertise: row.expertise ?? '', email: row.email ?? '', phone: row.phone ?? '', startDate: row.startDate ? row.startDate.slice(0, 10) : '', endDate: row.endDate ? row.endDate.slice(0, 10) : '' });
        setModalOpen(true);
      }} onDelete={(row) => setDeleteId(row.id)} />

      <FormModal
        title={editingId ? 'Edit Mentor' : 'Add Mentor'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Mentor"
        message="Are you sure?"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
