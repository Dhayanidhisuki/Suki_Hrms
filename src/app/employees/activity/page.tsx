/**
 * Employee Activity — read-only chronological timeline across all employees.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { DataTable, type Column } from '@/components/ui';

interface ActivityItem {
  id: number;
  activityType: string;
  activityAt: string;
  module: string;
  oldValue: string | null;
  newValue: string | null;
  remarks: string | null;
  source: string | null;
  employee: { id: number; employeeCode: string; firstName: string; lastName: string };
}

interface ApiResponse {
  data: ActivityItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function EmployeeActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(search ? { search } : {}) });
      const res = await fetch(`/api/employees/activity?${params}`);
      if (!res.ok) throw new Error('Failed to fetch activity');
      const json: ApiResponse = await res.json();
      setItems(json.data);
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

  const columns: Column<ActivityItem>[] = [
    {
      key: 'activityAt',
      label: 'Date/Time',
      render: (row) => new Date(row.activityAt).toLocaleString(),
    },
    {
      key: 'employee',
      label: 'Employee',
      render: (row) => (
        <Link href={`/employees/${row.employee.id}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
          {row.employee.firstName} {row.employee.lastName} ({row.employee.employeeCode})
        </Link>
      ),
    },
    { key: 'module', label: 'Module' },
    { key: 'activityType', label: 'Activity Type' },
    { key: 'remarks', label: 'Remarks', render: (row) => row.remarks ?? '—' },
    { key: 'source', label: 'Source', render: (row) => row.source ?? '—' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Employee Activity
        </h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Read-only chronological timeline of changes across all employees.
        </p>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={items}
        pagination={pagination}
        loading={loading}
        searchValue={search}
        searchPlaceholder="Search by employee code or name..."
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onPageChange={setPage}
        emptyMessage="No activity recorded yet."
      />
    </div>
  );
}
