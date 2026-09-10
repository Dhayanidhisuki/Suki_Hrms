/**
 * Reusable generic CRUD page for Pattern A simple master tables.
 * Used by: Designation, EmployeeType, Category, Unit, Grade, Level,
 * LeaveMaster, LoanType, AssetMaster.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef } from '@/components/ui';

interface SimpleMaster {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Extra columns/relations returned by masters that extend the simple shape (e.g. Grade.designation). */
  [extra: string]: unknown;
}

interface ApiResponse {
  data: SimpleMaster[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const codeField: FieldDef = { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. MGR' };
const autoCodeField: FieldDef = { name: 'code', label: 'Code', type: 'text', disabled: true, helpText: 'Generated automatically' };
const nameField: FieldDef = { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Manager' };
const descriptionField: FieldDef = { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional' };
const activeField: FieldDef = { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true };

const simpleFields: FieldDef[] = [codeField, nameField, descriptionField, activeField];

interface SimpleMasterPageProps {
  title: string;
  apiPath: string;
  addLabel?: string;
  /**
   * Render as a section inside a larger page (smaller heading) instead of a
   * standalone page with an h1 — used by the combined Employee Masters tabs.
   */
  embedded?: boolean;
  /** Extra form fields shown before Code (e.g. a parent-master select). */
  extraFields?: FieldDef[];
  /** Extra table columns shown after Name. */
  extraColumns?: Column<SimpleMaster>[];
  /** Extra initial form values when editing a row (for the extraFields). */
  extraInitialValues?: (row: SimpleMaster) => Record<string, string | number | boolean | undefined>;
  /**
   * Code is a system id, not something an admin types — the API generates
   * it. Hides the Code field on Add; shows it disabled (for reference) on Edit.
   */
  autoCode?: boolean;
}

export default function SimpleMasterPage({
  title,
  apiPath,
  addLabel,
  embedded = false,
  extraFields = [],
  extraColumns = [],
  extraInitialValues,
  autoCode = false,
}: SimpleMasterPageProps) {
  const [records, setRecords] = useState<SimpleMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const res = await fetch(`${apiPath}?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data);
      setPagination(json.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiPath, page, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({ isActive: true });
    setModalOpen(true);
  };

  const handleEdit = (row: SimpleMaster) => {
    setEditingId(row.id);
    setInitialValues({
      code: row.code,
      name: row.name,
      description: row.description ?? '',
      isActive: row.isActive,
      ...(extraInitialValues ? extraInitialValues(row) : {}),
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload = { ...values, description: values.description || null };
    const url = editingId ? `${apiPath}/${editingId}` : apiPath;
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`${apiPath}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  const columns: Column<SimpleMaster>[] = [
    { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
    { key: 'name', label: 'Name' },
    ...extraColumns,
    { key: 'description', label: 'Description', render: (row) => row.description ?? '—' },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => (
        <span
          className="px-2 py-0.5 text-xs font-medium rounded-full"
          style={{
            backgroundColor: row.isActive ? '#dcfce7' : '#fee2e2',
            color: row.isActive ? '#166534' : '#991b1b',
          }}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {embedded ? (
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            {title}
          </h2>
        ) : (
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            {title}
          </h1>
        )}
        <button
          onClick={handleAdd}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + {addLabel ?? `Add ${title.replace(/s$/, '')}`}
        </button>
      </div>

      {error && (
        <div
          className="rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
        >
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
        title={editingId ? `Edit ${title.replace(/s$/, '')}` : `Add ${title.replace(/s$/, '')}`}
        fields={
          autoCode
            ? [...extraFields, ...(editingId ? [autoCodeField] : []), nameField, descriptionField, activeField]
            : [...extraFields, ...simpleFields]
        }
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title={`Delete ${title.replace(/s$/, '')}`}
        message={`Are you sure you want to soft-delete this ${title.replace(/s$/, '').toLowerCase()}? It will be marked inactive and hidden from lists.`}
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
