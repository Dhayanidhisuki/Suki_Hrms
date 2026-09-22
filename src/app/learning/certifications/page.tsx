'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface Certification { id: number; name: string; issuingBody: string | null; validityMonths: number | null; category: string | null; isMandatory: boolean; }

const fields: FieldDef[] = [
  { name: 'name', label: 'Certification Name', type: 'text', required: true },
  { name: 'issuingBody', label: 'Issuing Body', type: 'text' },
  { name: 'validityMonths', label: 'Validity (months)', type: 'number' },
  { name: 'category', label: 'Category', type: 'text' },
  { name: 'isMandatory', label: 'Mandatory', type: 'checkbox' },
  { name: 'description', label: 'Description', type: 'textarea' },
];

export default function CertificationsPage() {
  const [records, setRecords] = useState<Certification[]>([]);
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
        const res = await fetch('/api/certification-masters');
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
    const url = editingId ? `/api/certification-masters/${editingId}` : '/api/certification-masters';
    const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/certification-masters/${id}`, { method: 'DELETE' });
    if (!res.ok) { setError((await res.json()).error ?? 'Delete failed'); return; }
    setRefresh((n) => n + 1);
  };

  const columns: Column<Certification>[] = [
    { key: 'name', label: 'Certification', sortable: true },
    { key: 'issuingBody', label: 'Issuing Body', render: (r) => r.issuingBody ?? '—' },
    { key: 'validityMonths', label: 'Validity', render: (r) => (r.validityMonths ? r.validityMonths + ' mo' : '—') },
    { key: 'category', label: 'Category', render: (r) => r.category ?? '—' },
    { key: 'isMandatory', label: 'Mandatory', render: (r) => (r.isMandatory ? 'Yes' : 'No') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Certification Types</h1>
        <button onClick={() => { setEditingId(null); setInitialValues({}); setModalOpen(true); }} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90" style={{ backgroundColor: 'var(--accent)' }}>
          + Add Certification
        </button>
      </div>

      <KPIGrid columns={2}>
        <KPICard label="Certifications" value={records.length} tone="info" />
        <KPICard label="Mandatory" value={records.filter((r) => r.isMandatory).length} tone="warning" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable columns={columns} data={records} loading={loading} onEdit={(row) => {
        setEditingId(row.id);
        setInitialValues({ name: row.name, issuingBody: row.issuingBody ?? '', validityMonths: row.validityMonths ?? '', category: row.category ?? '', isMandatory: row.isMandatory });
        setModalOpen(true);
      }} onDelete={(row) => setDeleteId(row.id)} />

      <FormModal
        title={editingId ? 'Edit Certification' : 'Add Certification'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Certification"
        message="Are you sure?"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
