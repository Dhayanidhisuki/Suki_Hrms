/**
 * Department Master — CRUD page using shared components.
 * Pattern A: simple master (code, name, description, isActive).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef, KPICard, KPIGrid, useToast, StatusPillTabs } from '@/components/ui';
import { Building2, CircleCheck, Users } from 'lucide-react';
import { useModuleStats } from '@/hooks/useModuleStats';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';

interface Department {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sanctionedHeadcount: number | null;
  /** Live count of active employees currently assigned here — derived server-side, not editable. */
  currentHeadcount: number;
  /** Count of active sub-departments under this department — derived server-side. */
  subDepartmentCount: number;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse {
  data: Department[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const fields: FieldDef[] = [
  { name: 'code', label: 'Dept Code', type: 'text', required: true, placeholder: 'e.g. IT' },
  { name: 'name', label: 'Dept Name', type: 'text', required: true, placeholder: 'e.g. Information Technology' },
  { name: 'sanctionedHeadcount', label: 'Sanctioned Headcount', type: 'number', min: 0, placeholder: 'e.g. 25', helpText: 'Approved/budgeted staffing count for this department.' },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional description' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
];

export default function DepartmentPage() {
  const toast = useToast();
  const [records, setRecords] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Server-side: the list is paginated, so a client-side filter would only
  // hide rows on the current page and misreport the total.
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const { stats } = useModuleStats('departments');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});

  // Delete state
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      });
      const res = await fetch(`/api/masters/departments?${params}`);
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

  const handleEdit = (row: Department) => {
    setEditingId(row.id);
    setInitialValues({
      code: row.code,
      name: row.name,
      sanctionedHeadcount: row.sanctionedHeadcount ?? '',
      description: row.description ?? '',
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

    const url = editingId
      ? `/api/masters/departments/${editingId}`
      : '/api/masters/departments';
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }

    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/masters/departments/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  const columns: Column<Department>[] = [
    { key: 'code', label: 'Dept Code', sortable: true, className: 'font-medium' },
    { key: 'name', label: 'Dept Name' },
    {
      key: 'headcount',
      label: 'Headcount (Current / Sanctioned)',
      render: (row) => {
        const { sanctionedHeadcount: sanctioned, currentHeadcount: current } = row;
        if (sanctioned == null) {
          return <span style={{ color: 'var(--foreground)' }}>{current} / —</span>;
        }
        const shortBy = sanctioned - current;
        return (
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--foreground)' }}>
              {current} / {sanctioned}
            </span>
            {shortBy > 0 ? (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
                title={`${shortBy} position${shortBy === 1 ? '' : 's'} still open against the sanctioned headcount`}
              >
                {shortBy} short
              </span>
            ) : shortBy < 0 ? (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}
                title="Currently staffed above the sanctioned headcount"
              >
                {-shortBy} over
              </span>
            ) : (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                Full
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'subDepartments',
      label: 'Sub Departments',
      render: (row) => (
        <Link
          href={`/masters/sub-departments?departmentId=${row.id}`}
          className="hover:underline"
          style={{ color: 'var(--accent)' }}
          title="View / add sub departments under this department"
        >
          {row.subDepartmentCount} {row.subDepartmentCount === 1 ? 'sub dept' : 'sub depts'}
        </Link>
      ),
    },
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
      <MasterGroupTabs groupLabel="Organization" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Departments
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Manage organizational departments, sanctioned headcounts, and sub-department mappings.
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Department
        </button>
      </div>

      {/* KPI Cards */}
      <KPIGrid columns={3}>
        <KPICard
          label="Total Departments"
          value={stats.total}
          tone="info"
          icon={<Building2 />}
          subtitle="Across all business units & facilities"
        />
        <KPICard
          label="Active Departments"
          value={stats.active ?? 0}
          tone="success"
          icon={<CircleCheck />}
          subtitle={
            stats.total > 0
              ? `${(((stats.active ?? 0) / stats.total) * 100).toFixed(1)}% operational`
              : undefined
          }
        />
        <KPICard
          label="Total Headcount"
          value={stats.custom?.currentHeadcount ?? 0}
          tone="accent"
          icon={<Users />}
          progress={{ max: Number(stats.custom?.sanctionedHeadcount ?? 0), label: 'Sanctioned' }}
        />
      </KPIGrid>


      <DataTable
        columns={columns}
        data={records}
        pagination={pagination}
        loading={loading}
        filtersLead
        filters={
          <StatusPillTabs
            items={[
              { value: '', label: 'All' },
              { value: 'active', label: 'Active', tone: 'success' },
              { value: 'inactive', label: 'Inactive', tone: 'neutral' },
            ]}
            value={status}
            onChange={(v) => { setStatus(v as '' | 'active' | 'inactive'); setPage(1); }}
            idPrefix="departments-status"
          />
        }
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
        title={editingId ? 'Edit Department' : 'Add Department'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Department"
        message="Are you sure you want to soft-delete this department? It will be marked inactive and hidden from lists."
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
