'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef, type FieldOption } from '@/components/ui';

interface SubDepartment {
  id: number;
  code: string;
  name: string;
  description: string | null;
  departmentId: number;
  sanctionedHeadcount: number | null;
  /** Live count of active employees currently assigned here — derived server-side, not editable. */
  currentHeadcount: number;
  isActive: boolean;
  deletedAt: string | null;
  department: { id: number; name: string };
}

interface ApiResponse {
  data: SubDepartment[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function SubDepartmentsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>}>
      <SubDepartmentsPageInner />
    </Suspense>
  );
}

function SubDepartmentsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Arriving from a department row ("View Sub Departments") scopes the list
  // and pre-fills the Add form to that department.
  const departmentIdFilter = searchParams.get('departmentId');

  const [records, setRecords] = useState<SubDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deptOptions, setDeptOptions] = useState<FieldOption[]>([]);

  const filteredDeptName = departmentIdFilter
    ? deptOptions.find((o) => String(o.value) === departmentIdFilter)?.label
    : undefined;

  useEffect(() => {
    fetch('/api/masters/departments?limit=100')
      .then((r) => r.json())
      .then((json: ApiResponse) => setDeptOptions(json.data.map((d) => ({ label: d.name, value: d.id }))));
  }, []);

  // Sub-Code is server-generated per department ("<DeptCode>-001"...) — no
  // field on Add; shown disabled (for reference) on Edit.
  const fields: FieldDef[] = [
    { name: 'departmentId', label: 'Department', type: 'select', required: true, options: deptOptions },
    ...(editingId
      ? [{ name: 'code', label: 'Sub-Code', type: 'text', disabled: true, helpText: 'Generated automatically' } as FieldDef]
      : []),
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. IT Support' },
    { name: 'sanctionedHeadcount', label: 'Sanctioned Headcount', type: 'number', min: 0, placeholder: 'e.g. 10', helpText: 'Approved/budgeted staffing count for this sub-department.' },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional' },
    { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search ? { search } : {}),
        ...(departmentIdFilter ? { departmentId: departmentIdFilter } : {}),
      });
      const res = await fetch(`/api/masters/sub-departments?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data);
      setPagination(json.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, search, departmentIdFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({ isActive: true, ...(departmentIdFilter ? { departmentId: Number(departmentIdFilter) } : {}) });
    setModalOpen(true);
  };
  const handleEdit = (row: SubDepartment) => {
    setEditingId(row.id);
    setInitialValues({
      code: row.code,
      name: row.name,
      sanctionedHeadcount: row.sanctionedHeadcount ?? '',
      description: row.description ?? '',
      departmentId: row.departmentId,
      isActive: row.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload = {
      ...values,
      description: values.description || null,
      sanctionedHeadcount: values.sanctionedHeadcount === '' ? null : values.sanctionedHeadcount,
    };
    const url = editingId ? `/api/masters/sub-departments/${editingId}` : '/api/masters/sub-departments';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? 'Save failed'); }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/sub-departments/${id}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); setError(err.error ?? 'Delete failed'); return; }
    fetchData();
  };

  const columns: Column<SubDepartment>[] = [
    { key: 'code', label: 'Sub-Code', sortable: true, className: 'font-medium' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department', render: (row) => row.department?.name ?? '—' },
    {
      key: 'headcount',
      label: 'Headcount (Sanctioned / Current)',
      render: (row) => `${row.sanctionedHeadcount ?? '—'} / ${row.currentHeadcount}`,
    },
    { key: 'description', label: 'Description', render: (row) => row.description ?? '—' },
    {
      key: 'isActive', label: 'Status',
      render: (row) => (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full"
          style={{ backgroundColor: row.isActive ? '#dcfce7' : '#fee2e2', color: row.isActive ? '#166534' : '#991b1b' }}>
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Sub Departments</h1>
          {departmentIdFilter && (
            <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
              Showing sub departments under <strong>{filteredDeptName ?? `department #${departmentIdFilter}`}</strong>{' '}
              &mdash;{' '}
              <button onClick={() => router.push('/masters/sub-departments')} className="hover:underline" style={{ color: 'var(--accent)' }}>
                clear filter
              </button>
            </p>
          )}
        </div>
        <button onClick={handleAdd} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}>+ Add Sub Department</button>
      </div>
      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}
      <DataTable columns={columns} data={records} pagination={pagination} loading={loading}
        searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} onPageChange={setPage}
        onEdit={handleEdit} onDelete={(row) => setDeleteId(row.id)} />
      <FormModal title={editingId ? 'Edit Sub Department' : 'Add Sub Department'} fields={fields}
        initialValues={initialValues} isOpen={modalOpen} onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit} submitLabel={editingId ? 'Update' : 'Create'} />
      <ConfirmDialog title="Delete Sub Department" message="Are you sure you want to soft-delete this sub department?"
        isOpen={deleteId !== null} onConfirm={() => deleteId && handleDelete(deleteId)} onClose={() => setDeleteId(null)} />
    </div>
  );
}
