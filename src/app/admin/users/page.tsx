/**
 * User Master (Administration > User & Access) — CRUD page using shared
 * components. Follows the companies/page.tsx pattern, plus a role select
 * (fetched from /api/admin/roles) and a password field that is required
 * only when adding a new user — editing without touching it leaves the
 * stored password hash untouched.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef, type FieldOption } from '@/components/ui';

interface User {
  id: number;
  email: string;
  roleId: number;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  role: { id: number; code: string; name: string } | null;
}

interface ApiResponse {
  data: User[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function UsersPage() {
  const [records, setRecords] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [roleOptions, setRoleOptions] = useState<FieldOption[]>([]);

  useEffect(() => {
    fetch('/api/admin/roles?limit=100')
      .then((r) => r.json())
      .then((json: { data: { id: number; name: string; isActive: boolean }[] }) =>
        // Only offer active roles for assignment — an inactive role can
        // still be someone's current role (shown as-is on the row), but
        // shouldn't be newly assignable.
        setRoleOptions(
          json.data.filter((r) => r.isActive).map((r) => ({ label: r.name, value: r.id }))
        )
      )
      .catch(() => setRoleOptions([]));
  }, []);

  const fields: FieldDef[] = [
    { name: 'email', label: 'Email', type: 'text', required: true, placeholder: 'e.g. jane.doe@company.com' },
    {
      name: 'password',
      label: 'Password',
      type: 'password',
      required: editingId === null,
      helpText: editingId !== null ? 'Leave blank to keep the current password' : undefined,
    },
    { name: 'roleId', label: 'Role', type: 'select', required: true, options: roleOptions },
    { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const res = await fetch(`/api/admin/users?${params}`);
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

  const handleEdit = (row: User) => {
    setEditingId(row.id);
    setInitialValues({
      email: row.email,
      roleId: row.roleId,
      isActive: row.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const payload: Record<string, unknown> = {
      email: values.email,
      roleId: Number(values.roleId),
      isActive: Boolean(values.isActive),
    };
    if (values.password) {
      payload.password = values.password;
    }

    const url = editingId ? `/api/admin/users/${editingId}` : '/api/admin/users';
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
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  const columns: Column<User>[] = [
    { key: 'email', label: 'Email', sortable: true, className: 'font-medium' },
    { key: 'role', label: 'Role', render: (row) => row.role?.name ?? '—' },
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
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Users
        </h1>
        <button
          onClick={handleAdd}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add User
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
        searchPlaceholder="Search by email..."
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onPageChange={setPage}
        onEdit={handleEdit}
        onDelete={(row) => setDeleteId(row.id)}
      />

      <FormModal
        title={editingId ? 'Edit User' : 'Add User'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete User"
        message="Are you sure you want to soft-delete this user? Their account will be deactivated and they will no longer be able to sign in."
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
