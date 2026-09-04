/**
 * Company (tenant) management — superadmin only.
 * Pattern A: simple master (code, name, description), plus:
 * - Adding a company also asks for its admin password up front, chaining
 *   POST /api/superadmin/companies then POST .../bootstrap-admin so the
 *   company and its first login are created in one step.
 * - An "Admin Login" action per row opens the same password modal to
 *   reset an existing login's password later.
 * - isActive has its own quick toggle (eye icon in the Actions column,
 *   see renderRowActions) instead of living in the edit form, since
 *   deactivating a company has real consequences (blocks its logins).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, type Column, type FieldDef } from '@/components/ui';

interface Company {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  admin: { email: string; isActive: boolean } | null;
}

interface ApiResponse {
  data: Company[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// Edit only touches code/name/description — password is a separate action
// (Reset Password) and isActive has its own toggle (eye icon), both with
// real consequences that shouldn't be bundled into a plain field edit.
const editFields: FieldDef[] = [
  { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. KUNAERO' },
  { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. KUN Aerospace Private Limited' },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional description' },
];

// Only "Admin" (company-admin) exists today — add more of this company's
// starter roles here as they're introduced, no other change needed since
// the API already accepts any role code it seeded (see bootstrap-admin).
const ROLE_OPTIONS = [{ label: 'Admin', value: 'company-admin' }];

// Add asks for the admin password (and role) up front too, so creating a
// company and its first login is one step instead of two.
const addFields: FieldDef[] = [
  ...editFields,
  { name: 'role', label: 'Role', type: 'select', required: true, options: ROLE_OPTIONS, defaultValue: 'company-admin' },
  { name: 'password', label: 'Admin Password', type: 'password', required: true, placeholder: 'At least 6 characters' },
  { name: 'confirmPassword', label: 'Confirm Admin Password', type: 'password', required: true },
];

const EyeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a17.6 17.6 0 0 1-2.16 3.19M6.42 6.42C3.5 8.34 1 11.5 1 12s4 8 11 8a9.9 9.9 0 0 0 5.14-1.42" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <path d="M1 1l22 22" />
  </svg>
);

const passwordFields: FieldDef[] = [
  { name: 'role', label: 'Role', type: 'select', required: true, options: ROLE_OPTIONS, defaultValue: 'company-admin' },
  { name: 'password', label: 'New Password', type: 'password', required: true, placeholder: 'At least 6 characters' },
  { name: 'confirmPassword', label: 'Confirm Password', type: 'password', required: true },
];

export default function SuperadminCompaniesPage() {
  const [records, setRecords] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<Company | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [passwordModalRow, setPasswordModalRow] = useState<Company | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [toggleBusyId, setToggleBusyId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const res = await fetch(`/api/superadmin/companies?${params}`);
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
    setEditingRow(null);
    setInitialValues({ role: 'company-admin' });
    setModalOpen(true);
  };

  const handleEdit = (row: Company) => {
    setEditingRow(row);
    setInitialValues({
      code: row.code,
      name: row.name,
      description: row.description ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    // isActive is never edited through this form — it has its own toggle
    // (eye icon) since it has real consequences (blocks that company's
    // logins), so preserve the row's current value rather than letting the
    // API default it back to true on every edit.
    const payload = {
      code: values.code,
      name: values.name,
      description: values.description || null,
      isActive: editingRow?.isActive ?? true,
    };

    if (editingRow) {
      const res = await fetch(`/api/superadmin/companies/${editingRow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Save failed');
      }
      fetchData();
      return;
    }

    // Add: validate the admin password, create the company, then bootstrap
    // its first login with that password — one step for superadmin.
    const password = String(values.password ?? '');
    const confirmPassword = String(values.confirmPassword ?? '');
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }

    const createRes = await fetch('/api/superadmin/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.error ?? 'Save failed');
    }
    const company = await createRes.json();

    const bootstrapRes = await fetch(`/api/superadmin/companies/${company.id}/bootstrap-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, role: String(values.role ?? 'company-admin') }),
    });
    const bootstrapJson = await bootstrapRes.json();
    if (!bootstrapRes.ok) {
      // Company was created but the login wasn't — surface that clearly
      // rather than a generic failure, since retrying "Create" would now
      // 409 on the duplicate code.
      throw new Error(
        `Company created, but admin login failed: ${bootstrapJson.error ?? 'unknown error'}. Use "Create Login" on its row to retry.`
      );
    }

    setSuccessMessage(`${bootstrapJson.message} (${bootstrapJson.user.email})`);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/superadmin/companies/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  const handleToggleActive = async (row: Company) => {
    setToggleBusyId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/companies/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: row.code,
          name: row.name,
          description: row.description,
          isActive: !row.isActive,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to update status');
      }
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setToggleBusyId(null);
    }
  };

  const handleSetPassword = async (values: Record<string, string | number | boolean>) => {
    const password = String(values.password ?? '');
    const confirmPassword = String(values.confirmPassword ?? '');
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }
    if (!passwordModalRow) return;

    const res = await fetch(`/api/superadmin/companies/${passwordModalRow.id}/bootstrap-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, role: String(values.role ?? 'company-admin') }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to set admin login password');

    setSuccessMessage(`${json.message} (${json.user.email})`);
    fetchData();
  };

  const columns: Column<Company>[] = [
    { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
    { key: 'name', label: 'Name' },
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
    {
      key: 'adminLogin',
      label: 'Admin Login',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          {row.admin && (
            <span className="text-xs" style={{ color: 'var(--foreground)' }}>
              {row.admin.email}
              {!row.admin.isActive && (
                <span className="ml-1" style={{ color: '#991b1b' }}>
                  (inactive)
                </span>
              )}
            </span>
          )}
          <button
            onClick={() => setPasswordModalRow(row)}
            className="text-left text-xs font-medium hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            {row.admin ? 'Reset Password' : 'Create Login'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Companies
        </h1>
        <button
          onClick={handleAdd}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Add Company
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

      {successMessage && (
        <div
          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}
        >
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-xs font-medium hover:underline">
            Dismiss
          </button>
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
        renderRowActions={(row) => (
          <button
            onClick={() => handleToggleActive(row)}
            disabled={toggleBusyId === row.id}
            title={row.isActive ? 'Deactivate — blocks this company\'s logins' : 'Activate'}
            className="hover:opacity-70 disabled:opacity-40"
            style={{ color: row.isActive ? '#166534' : '#991b1b' }}
          >
            {row.isActive ? <EyeIcon /> : <EyeOffIcon />}
          </button>
        )}
      />

      <FormModal
        title={editingRow ? 'Edit Company' : 'Add Company'}
        fields={editingRow ? editFields : addFields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingRow ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete Company"
        message="Are you sure you want to soft-delete this company? It will be marked inactive and hidden from lists."
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />

      <FormModal
        title={passwordModalRow ? `${passwordModalRow.name} — ${passwordModalRow.admin ? 'Reset' : 'Set'} Admin Password` : ''}
        fields={passwordFields}
        initialValues={{ role: 'company-admin' }}
        isOpen={passwordModalRow !== null}
        onClose={() => setPasswordModalRow(null)}
        onSubmit={async (values) => {
          await handleSetPassword(values);
          setPasswordModalRow(null);
        }}
        submitLabel={passwordModalRow?.admin ? 'Reset Password' : 'Create Login'}
      />
    </div>
  );
}
