/**
 * Generic repeatable-record tab: a themed list (DataTable) + Add/Edit
 * (FormModal) + Delete (ConfirmDialog), scoped to one employee. Backs
 * Education, Experience, Dependents, Emergency Contacts, and Skill Matrix —
 * all of which are otherwise identical CRUD shapes against
 * /api/employees/[id]/<resource>[/[recordId]].
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef } from '@/components/ui';

interface RecordBase {
  id: number;
}

export interface RepeatableListTabProps<T extends RecordBase> {
  apiBasePath: string; // e.g. `/api/employees/5/education`
  title: string;
  addLabel: string;
  fields: FieldDef[];
  columns: Column<T>[];
  toFormValues?: (row: T) => Record<string, string | number | boolean | undefined>;
  emptyMessage?: string;
  deleteConfirmMessage?: string;
}

export default function RepeatableListTab<T extends RecordBase>({
  apiBasePath,
  title,
  addLabel,
  fields,
  columns,
  toFormValues,
  emptyMessage = 'No records yet.',
  deleteConfirmMessage = 'Are you sure you want to delete this record? This cannot be undone.',
}: RepeatableListTabProps<T>) {
  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiBasePath);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setRecords(json.data ?? json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({});
    setModalOpen(true);
  };

  const handleEdit = (row: T) => {
    setEditingId(row.id);
    setInitialValues(
      toFormValues
        ? toFormValues(row)
        : (Object.fromEntries(
            Object.entries(row).filter(([, v]) => v === null || typeof v !== 'object')
          ) as Record<string, string | number | boolean | undefined>)
    );
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const url = editingId ? `${apiBasePath}/${editingId}` : apiBasePath;
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`${apiBasePath}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {title}
        </h2>
        <button
          onClick={handleAdd}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {addLabel}
        </button>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        onEdit={handleEdit}
        onDelete={(row) => setDeleteId(row.id)}
        emptyMessage={emptyMessage}
      />

      <FormModal
        title={editingId ? `Edit — ${title}` : addLabel}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Add'}
      />

      <ConfirmDialog
        title={`Delete ${title} record`}
        message={deleteConfirmMessage}
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
