/**
 * Role Master (Administration > User & Access) — CRUD page using shared
 * components, plus a per-row "Permissions" action opening a bespoke grouped
 * checkbox modal (RolePermissionsModal) since FormModal doesn't fit that shape.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef } from '@/components/ui';
import RolePermissionsModal from './RolePermissionsModal';

interface Role {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { rolePermissions: number };
}

interface ApiResponse {
  data: Role[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const fields: FieldDef[] = [
  { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. hr-admin' },
  { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. HR Admin' },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional description' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
];

export default function RolesPage() {
  const [records, setRecords] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [permissionsRole, setPermissionsRole] = useState<Role | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const res = await fetch(`/api/admin/roles?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data);
      setPagination(json.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({ isActive: true });
    setModalOpen(true);
  };

  const handleEdit = (row: Role) => {
    setEditingId(row.id);
    setInitialValues({
      code: row.code,
      name: row.name,
      description: row.description ?? '',
      isActive: row.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload = {
      ...values,
      description: values.description || null,
    };

    const url = editingId ? `/api/admin/roles/${editingId}` : '/api/admin/roles';
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
    const res = await fetch(`/api/admin/roles/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  const columns: Column<Role>[] = [
    { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
    { key: 'name', label: 'Name' },
    { key: 'permissions', label: 'Permissions', render: (row) => row._count.rolePermissions },
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
    {
      key: 'permissionsAction',
      label: '',
      render: (row) => (
        <button
          onClick={() => setPermissionsRole(row)}
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          Permissions
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Roles
        </h1>
        <button
          onClick={handleAdd}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Role
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
        title={editingId ? 'Edit Role' : 'Add Role'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Role"
        message="Are you sure you want to soft-delete this role? It will be marked inactive and hidden from lists. Blocked if any active users are still assigned to it — reassign them first."
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />

      {permissionsRole && (
        <RolePermissionsModal
          roleId={permissionsRole.id}
          roleName={permissionsRole.name}
          isOpen={permissionsRole !== null}
          onClose={() => setPermissionsRole(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
