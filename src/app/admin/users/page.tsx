/**
 * User Master (Administration > User & Access) — CRUD page using shared
 * components. Follows the companies/page.tsx pattern, plus a role select
 * (fetched from /api/admin/roles) and a password field that is required
 * only when adding a new user — editing without touching it leaves the
 * stored password hash untouched.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, ConfirmDialog, useToast, type Column, type FieldDef, type FieldOption } from '@/components/ui';

interface User {
  id: number;
  email: string;
  loginId: string | null;
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

/** Just enough of an Employee to power the Add User picker's auto-fill —
 * name, code (becomes Login ID), and the office/personal email fallback.
 * "Employee ID/Code" throughout the rest of the app is oldEmployeeCode (the
 * company-issued code, may be blank) — employeeCode is the system-generated
 * "Reference Code", always present, used only as a fallback when
 * oldEmployeeCode is blank (same convention as employee-form-fields.ts's
 * toReportingManagerOptions). */
interface EmployeePickerRow {
  id: number;
  employeeCode: string;
  oldEmployeeCode: string | null;
  firstName: string;
  lastName: string;
  officeEmail: string | null;
  personalDetails: { personalEmail: string | null } | null;
}

/** The "Employee ID/Code" used everywhere else in the app is oldEmployeeCode
 * (company-issued) — shown as-is, never substituting employeeCode (the
 * system-generated "Reference Code") when it's blank. */
function employeeIdOf(e: EmployeePickerRow): string {
  return e.oldEmployeeCode ?? '';
}

export default function UsersPage() {
  const toast = useToast();
  const [records, setRecords] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [roleOptions, setRoleOptions] = useState<FieldOption[]>([]);

  // Employee ID picker (Add User only) — fetched once, keyed by id, so
  // picking one can synchronously derive Name / Login ID (via `compute`)
  // and suggest an Email (via `onFieldChange`) without a second round trip.
  const [employeeOptions, setEmployeeOptions] = useState<FieldOption[]>([]);
  const [employeesById, setEmployeesById] = useState<Record<number, EmployeePickerRow>>({});

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

    fetch('/api/employees?limit=500')
      .then((r) => r.json())
      .then((json: { data: EmployeePickerRow[] }) => {
        const rows = json.data ?? [];
        setEmployeeOptions(
          rows.map((e) => ({
            label: employeeIdOf(e) ? `${employeeIdOf(e)} — ${e.firstName} ${e.lastName}` : `${e.firstName} ${e.lastName}`,
            value: e.id,
          }))
        );
        setEmployeesById(Object.fromEntries(rows.map((e) => [e.id, e])));
      })
      .catch(() => {
        setEmployeeOptions([]);
        setEmployeesById({});
      });
  }, []);

  const fields: FieldDef[] = [
    ...(editingId === null
      ? ([
          {
            name: 'employeeId',
            label: 'Employee ID',
            type: 'select',
            options: employeeOptions,
            helpText: 'Optional — link this login to an employee to auto-fill their name, email and login ID.',
          },
          {
            name: 'employeeName',
            label: 'Employee Name',
            type: 'text',
            compute: (v) => {
              const emp = v.employeeId ? employeesById[Number(v.employeeId)] : undefined;
              return emp ? `${emp.firstName} ${emp.lastName}` : '';
            },
            showIf: (v) => Boolean(v.employeeId),
          },
          {
            name: 'loginId',
            label: 'Login ID',
            type: 'text',
            compute: (v) => {
              const emp = v.employeeId ? employeesById[Number(v.employeeId)] : undefined;
              return emp ? employeeIdOf(emp) : '';
            },
            showIf: (v) => Boolean(v.employeeId),
            helpText: 'Set to the employee\'s own code.',
          },
        ] as FieldDef[])
      : []),
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
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: ApiResponse = await res.json();
      setRecords(json.data);
      setPagination(json.pagination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, search, toast]);

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
    if (editingId === null && values.employeeId) {
      payload.employeeId = Number(values.employeeId);
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
      toast.error(err.error ?? 'Delete failed');
      return;
    }
    fetchData();
  };

  const columns: Column<User>[] = [
    { key: 'email', label: 'Email', sortable: true, className: 'font-medium' },
    { key: 'loginId', label: 'Login ID', render: (row) => row.loginId ?? '—' },
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
        onFieldChange={(name, value) => {
          // One-time suggestion when an Employee is picked — office email
          // first, personal email as fallback, blank if neither is set.
          // Doesn't fire again on later edits, so it never fights a manual
          // correction to the suggested address.
          if (name !== 'employeeId') return;
          const emp = value ? employeesById[Number(value)] : undefined;
          if (!emp) return;
          return { email: emp.officeEmail || emp.personalDetails?.personalEmail || '' };
        }}
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
