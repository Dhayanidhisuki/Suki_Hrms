/**
 * Salary Components — this company's own catalog (migration 000012 made
 * SalaryComponent company-scoped; previously one global list shared by
 * every company with no admin UI at all). Not built on SimpleMasterPage
 * (used by 9 other masters pages) since it needs a `type` selector and has
 * no `description` column — same DataTable/FormModal/ConfirmDialog shape,
 * hand-built. System-defined rows (BASIC/PF/ESI/ARREAR_GROSS/ARREAR_PF/
 * ARREAR_ESI/BONUS — the codes Payroll/Arrear/Bonus depend on) show a
 * badge and have no Edit/Delete.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef } from '@/components/ui';

interface SalaryComponentRow {
  id: number;
  code: string;
  name: string;
  type: string;
  includeInGratuity: boolean;
  isSystemDefined: boolean;
  isActive: boolean;
}

const fields: FieldDef[] = [
  { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. SPL_ALLOW_2' },
  { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Special Allowance' },
  {
    name: 'type',
    label: 'Type',
    type: 'select',
    required: true,
    options: [
      { label: 'Earning', value: 'earning' },
      { label: 'Deduction', value: 'deduction' },
      { label: 'Employer Contribution', value: 'employer_contribution' },
    ],
  },
  { name: 'includeInGratuity', label: 'Include in Gratuity', type: 'checkbox', defaultValue: false },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
];

export default function SalaryComponentsPage() {
  const [records, setRecords] = useState<SalaryComponentRow[]>([]);
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
      const res = await fetch('/api/masters/salary-components');
      if (!res.ok) throw new Error('Failed to fetch');
      const json: { data: SalaryComponentRow[] } = await res.json();
      setRecords(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({ isActive: true, includeInGratuity: false });
    setModalOpen(true);
  };

  const handleEdit = (row: SalaryComponentRow) => {
    setEditingId(row.id);
    setInitialValues({
      code: row.code,
      name: row.name,
      type: row.type,
      includeInGratuity: row.includeInGratuity,
      isActive: row.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const url = editingId ? `/api/masters/salary-components/${editingId}` : '/api/masters/salary-components';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/salary-components/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  // Inline toggle — works for system-defined rows too, since the PUT route
  // permits includeInGratuity changes even when code/name/type are locked.
  const toggleGratuity = async (row: SalaryComponentRow) => {
    setError(null);
    const res = await fetch(`/api/masters/salary-components/${row.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: row.code,
        name: row.name,
        type: row.type,
        isActive: row.isActive,
        includeInGratuity: !row.includeInGratuity,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Failed to update');
      return;
    }
    fetchData();
  };

  const columns: Column<SalaryComponentRow>[] = [
    { key: 'code', label: 'Code', className: 'font-medium' },
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type', render: (r) => r.type.replace('_', ' ') },
    {
      key: 'includeInGratuity',
      label: 'Gratuity',
      render: (r) => (
        <input type="checkbox" checked={r.includeInGratuity} onChange={() => toggleGratuity(r)} />
      ),
    },
    {
      key: 'isSystemDefined',
      label: '',
      render: (r) =>
        r.isSystemDefined ? (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>
            System
          </span>
        ) : null,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => (
        <span
          className="px-2 py-0.5 text-xs font-medium rounded-full"
          style={{ backgroundColor: row.isActive ? '#dcfce7' : '#fee2e2', color: row.isActive ? '#166534' : '#991b1b' }}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r) =>
        r.isSystemDefined ? null : (
          <div className="flex gap-3 justify-end">
            <button onClick={() => handleEdit(r)} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
              Edit
            </button>
            <button onClick={() => setDeleteId(r.id)} className="text-xs font-medium hover:underline text-red-500">
              Delete
            </button>
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Salary Components
        </h1>
        <button
          onClick={handleAdd}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Component
        </button>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <DataTable columns={columns} data={records} loading={loading} emptyMessage="No salary components yet." />

      <FormModal
        title={editingId ? 'Edit Salary Component' : 'Add Salary Component'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Salary Component"
        message="Are you sure you want to soft-delete this component? It will be marked inactive and hidden from lists."
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
