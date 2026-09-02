/**
 * Employee Master — list page.
 * Real DB data, server-side pagination/search/filtering, themed via the
 * shared ui kit (DataTable) instead of hardcoded gray classes.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DataTable, type Column } from '@/components/ui';

interface ExpirySummary {
  total: number;
  expired: number;
  expiringSoon: number;
  valid: number;
  noExpiry: number;
}

interface EmployeeListItem {
  id: number;
  employeeCode: string;
  oldEmployeeCode: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  status: string;
  isActive: boolean;
  company: { id: number; name: string } | null;
  jobInfos: Array<{
    department: { name: string };
    designation: { name: string };
    employeeType: { name: string };
    unit: { name: string } | null;
  }>;
  reportingManager: { firstName: string; lastName: string; employeeCode: string } | null;
  documentExpirySummary: ExpirySummary;
  createdAt: string;
}

interface ApiResponse {
  data: EmployeeListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  active: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  'on-leave': { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  terminated: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  resigned: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
};

export default function EmployeeListPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/employees?${params}`);
      if (!res.ok) throw new Error('Failed to fetch employees');
      const json: ApiResponse = await res.json();
      setEmployees(json.data);
      setPagination(json.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const columns: Column<EmployeeListItem>[] = [
    { key: 'oldEmployeeCode', label: 'Employee Code', className: 'font-medium', render: (row) => row.oldEmployeeCode ?? '—' },
    { key: 'employeeCode', label: 'Reference Code', sortable: true },
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <span className="inline-flex items-center gap-2">
          <Link href={`/employees/${row.id}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
            {row.firstName} {row.middleName ?? ''} {row.lastName}
          </Link>
          {!row.isActive && (
            <span
              className="px-2 py-0.5 text-xs font-medium rounded-full"
              style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}
            >
              Inactive
            </span>
          )}
        </span>
      ),
    },
    { key: 'company', label: 'Company/Unit', render: (row) => row.jobInfos[0]?.unit?.name ?? row.company?.name ?? '—' },
    { key: 'department', label: 'Department', render: (row) => row.jobInfos[0]?.department.name ?? '—' },
    { key: 'designation', label: 'Designation', render: (row) => row.jobInfos[0]?.designation.name ?? '—' },
    { key: 'employeeType', label: 'Type', render: (row) => row.jobInfos[0]?.employeeType.name ?? '—' },
    {
      key: 'reportingManager',
      label: 'Reporting Manager',
      render: (row) =>
        row.reportingManager
          ? `${row.reportingManager.firstName} ${row.reportingManager.lastName}`
          : '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        const tone = STATUS_TONE[row.status] ?? { bg: 'var(--surface-muted)', fg: 'var(--foreground-muted)' };
        return (
          <span
            className="px-2 py-0.5 text-xs font-medium rounded-full"
            style={{ backgroundColor: tone.bg, color: tone.fg }}
          >
            {row.status}
          </span>
        );
      },
    },
    {
      key: 'documents',
      label: 'Docs',
      render: (row) => {
        const s = row.documentExpirySummary;
        if (s.total === 0) return <span style={{ color: 'var(--foreground-muted)' }}>—</span>;
        return (
          <span className="text-xs">
            {s.expired > 0 && <span style={{ color: 'var(--danger)' }}>{s.expired} expired</span>}
            {s.expired > 0 && s.expiringSoon > 0 && <span style={{ color: 'var(--foreground-muted)' }}>, </span>}
            {s.expiringSoon > 0 && <span style={{ color: 'var(--warning)' }}>{s.expiringSoon} expiring</span>}
            {s.expired === 0 && s.expiringSoon === 0 && (
              <span style={{ color: 'var(--foreground-muted)' }}>{s.total} valid</span>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Employee Master
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            {pagination.total} employee{pagination.total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/employees/export${search ? `?search=${encodeURIComponent(search)}` : ''}`}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Export CSV
          </a>
          <Link
            href="/employees/new"
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            + Add Employee
          </Link>
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}
        >
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={employees}
        pagination={pagination}
        loading={loading}
        searchValue={search}
        searchPlaceholder="Search by code or name..."
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onPageChange={setPage}
        onEdit={(row) => router.push(`/employees/${row.id}`)}
        emptyMessage='No employees found. Click "Add Employee" to create one.'
      />
    </div>
  );
}
