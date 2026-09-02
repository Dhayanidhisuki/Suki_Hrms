/**
 * Permissions catalog — read-only view.
 * Permissions are defined by the seed script (POST /api/auth/seed), not
 * created or edited through the UI, so this page has no Add/Edit/Delete.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, type Column } from '@/components/ui';

interface Permission {
  id: number;
  code: string;
  module: string;
  submodule: string | null;
  page: string | null;
  action: string;
  description: string | null;
  isActive: boolean;
}

export default function PermissionsPage() {
  const [records, setRecords] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/permissions');
      if (!res.ok) throw new Error('Failed to fetch');
      const json: Permission[] = await res.json();
      setRecords(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = search
    ? records.filter((r) =>
        [r.code, r.module, r.submodule ?? '', r.page ?? '', r.action, r.description ?? '']
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : records;

  const columns: Column<Permission>[] = [
    { key: 'module', label: 'Module', sortable: true, className: 'font-medium' },
    { key: 'submodule', label: 'Submodule', render: (row) => row.submodule ?? '—' },
    { key: 'page', label: 'Page', render: (row) => row.page ?? '—' },
    { key: 'action', label: 'Action' },
    { key: 'code', label: 'Code', className: 'font-mono text-xs' },
    { key: 'description', label: 'Description', render: (row) => row.description ?? '—' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Permissions
        </h1>
      </div>

      <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
        The permission catalog is defined by the seed script and cannot be edited here. Assign
        permissions to roles from the Roles page.
      </p>

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
        data={filtered}
        loading={loading}
        searchValue={search}
        searchPlaceholder="Search permissions..."
        onSearchChange={setSearch}
        emptyMessage="No permissions found."
      />
    </div>
  );
}
