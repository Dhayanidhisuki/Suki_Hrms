'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface ChecklistItem {
  id: number;
  label: string;
  sortOrder: number;
  isMandatory: boolean;
}

interface Checklist {
  id: number;
  name: string;
  checklistType: string;
  isActive: boolean;
  items?: ChecklistItem[];
}

const TYPE_OPTIONS = [
  { label: 'Pre-Training', value: 'PRE' },
  { label: 'Post-Training', value: 'POST' },
  { label: 'General', value: 'GENERAL' },
];

function itemsToLines(items: ChecklistItem[] | undefined): string {
  if (!items) return '';
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => `${i.isMandatory ? '! ' : ''}${i.label}`).join('\n');
}

function linesToItems(text: string) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line, idx) => ({
    label: line.replace(/^!\s*/, ''),
    isMandatory: line.startsWith('!'),
    sortOrder: idx,
  }));
}

export default function ChecklistsPage() {
  const [records, setRecords] = useState<Checklist[]>([]);
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
        const res = await fetch('/api/training-checklists');
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

  const fields: FieldDef[] = [
    { name: 'name', label: 'Checklist Name', type: 'text', required: true },
    { name: 'checklistType', label: 'Type', type: 'select', options: TYPE_OPTIONS, required: true },
    {
      name: 'itemsText', label: 'Items (one per line)', type: 'textarea',
      helpText: 'Prefix a line with ! to mark the item mandatory, e.g. "! Verify projector".',
      placeholder: '! Confirm venue booking\nSend invite to nominees\nPrint attendance sheet',
    },
  ];

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const { itemsText, ...rest } = values;
    const payload = { ...rest, items: linesToItems(String(itemsText ?? '')) };
    const url = editingId ? `/api/training-checklists/${editingId}` : '/api/training-checklists';
    const res = await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/training-checklists/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError((await res.json()).error ?? 'Delete failed');
      return;
    }
    setRefresh((n) => n + 1);
  };

  const columns: Column<Checklist>[] = [
    { key: 'name', label: 'Checklist', sortable: true },
    { key: 'checklistType', label: 'Type' },
    { key: 'items', label: 'Items', render: (r) => r.items?.length ?? 0 },
    { key: 'mandatory', label: 'Mandatory', render: (r) => r.items?.filter((i) => i.isMandatory).length ?? 0 },
    {
      key: 'preview', label: 'Preview',
      render: (r) => (r.items?.length ? r.items.slice(0, 2).map((i) => i.label).join(', ') + (r.items.length > 2 ? '…' : '') : '—'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Training Checklists</h1>
        <button
          onClick={() => { setEditingId(null); setInitialValues({ checklistType: 'GENERAL' }); setModalOpen(true); }}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Checklist
        </button>
      </div>

      <KPIGrid columns={3}>
        <KPICard label="Checklists" value={records.length} tone="info" />
        <KPICard label="Pre-Training" value={records.filter((r) => r.checklistType === 'PRE').length} tone="warning" />
        <KPICard label="Post-Training" value={records.filter((r) => r.checklistType === 'POST').length} tone="success" />
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        onEdit={(r) => {
          setEditingId(r.id);
          setInitialValues({ name: r.name, checklistType: r.checklistType, itemsText: itemsToLines(r.items) });
          setModalOpen(true);
        }}
        onDelete={(r) => setDeleteId(r.id)}
      />

      <FormModal title={editingId ? 'Edit Checklist' : 'Add Checklist'} fields={fields} initialValues={initialValues}
        isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'} />

      <ConfirmDialog title="Delete Checklist" message="Delete this checklist and all its items?"
        isOpen={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}
