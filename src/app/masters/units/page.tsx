/**
 * Unit Master — doubles as Branch/Site/Plant/Work Location, scoped to a Company.
 * Pattern B: simple master + FK (companyId), mirrors sub-departments/page.tsx.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, useToast, type Column, type FieldDef, type FieldOption, StatusPillTabs } from '@/components/ui';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';

interface Unit {
  id: number;
  code: string;
  name: string;
  address: string | null;
  description: string | null;
  gstNumber: string | null;
  companyId: number;
  isActive: boolean;
  deletedAt: string | null;
  company: { id: number; name: string } | null;
}

interface ApiResponse {
  data: Unit[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function UnitsPage() {
  const toast = useToast();
  const [records, setRecords] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Server-side: the list is paginated, so a client-side filter would only
  // hide rows on the current page and misreport the total.
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [companyOptions, setCompanyOptions] = useState<FieldOption[]>([]);

  useEffect(() => {
    fetch('/api/masters/companies?limit=100')
      .then((r) => r.json())
      .then((json: { data: { id: number; name: string }[] }) =>
        setCompanyOptions(json.data.map((c) => ({ label: c.name, value: c.id })))
      );
  }, []);

  // Code is server-generated per company ("<CompanyCode>-001"...) — no field
  // on Add; shown disabled (for reference) on Edit.
  const fields: FieldDef[] = [
    { name: 'companyId', label: 'Company', type: 'select', required: true, options: companyOptions },
    ...(editingId
      ? [{ name: 'code', label: 'Code', type: 'text', disabled: true, helpText: 'Generated automatically' } as FieldDef]
      : []),
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Chennai Plant' },
    { name: 'gstNumber', label: 'GST No.', type: 'text', placeholder: 'e.g. 29ABCDE1234F1Z5' },
    { name: 'address', label: 'Address', type: 'textarea', placeholder: 'Optional' },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional' },
    { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      });
      const res = await fetch(`/api/masters/units?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data);
      setPagination(json.pagination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({ isActive: true });
    setModalOpen(true);
  };

  const handleEdit = (row: Unit) => {
    setEditingId(row.id);
    setInitialValues({
      code: row.code,
      name: row.name,
      gstNumber: row.gstNumber ?? '',
      address: row.address ?? '',
      description: row.description ?? '',
      companyId: row.companyId,
      isActive: row.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload = { ...values, address: values.address || null, description: values.description || null, gstNumber: values.gstNumber || null };
    const url = editingId ? `/api/masters/units/${editingId}` : '/api/masters/units';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/units/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  const columns: Column<Unit>[] = [
    { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
    { key: 'name', label: 'Name' },
    { key: 'company', label: 'Company', render: (row) => row.company?.name ?? '—' },
    { key: 'gstNumber', label: 'GST No.', render: (row) => row.gstNumber ?? '—' },
    { key: 'address', label: 'Address', render: (row) => row.address ?? '—' },
    { key: 'description', label: 'Description', render: (row) => row.description ?? '—' },
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
  ];

  return (
    <div className="space-y-4">
      <MasterGroupTabs groupLabel="Organization" />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Units
        </h1>
        <button
          onClick={handleAdd}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Unit
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">

        <StatusPillTabs

          items={[

            { value: '', label: 'All' },

            { value: 'active', label: 'Active', tone: 'success' },

            { value: 'inactive', label: 'Inactive', tone: 'neutral' },

          ]}

          value={status}

          onChange={(v) => { setStatus(v as '' | 'active' | 'inactive'); setPage(1); }}

          idPrefix="units-status"

        />

      </div>


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
        title={editingId ? 'Edit Unit' : 'Add Unit'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Unit"
        message="Are you sure you want to soft-delete this unit? It will be marked inactive and hidden from lists."
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
